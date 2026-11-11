import { DifficultySchema } from "@the-stacks/dnd5e-engine";
import { openRulings } from "@the-stacks/session-model";
import { z } from "zod";
import { callJson } from "./pipeline/call.js";
import type { NodeDeps } from "./pipeline/context.js";
import { buildRulingPrompt, PROMPT_VERSION } from "./prompts/ruling.js";
import { PURPOSE_OF } from "./purposes.js";

/**
 * Spec 102 FR-023: answers every open ruling request, oldest first, with one structured model
 * call each, then submits a `ruling` Intent from `ai:dm`. The model returns a decision and a
 * difficulty tier, never a number; the engine rolls. Runs at the start of every AI-seat turn.
 * A failed call leaves the request open and is logged; it never fails the turn.
 */
export async function answerRulings(
  deps: Pick<
    NodeDeps,
    "gateway" | "gate" | "loadProjections" | "newId" | "log" | "recordCall"
  >,
  sessionId: string,
  signal: AbortSignal,
): Promise<{ answered: number }> {
  const p = await deps.loadProjections(sessionId);
  if (p.gate.seat.kind !== "ai") return { answered: 0 };
  const open = Object.values(openRulings(p));
  let answered = 0;
  for (const request of open) {
    if (signal.aborted) break;
    const needsTier = request.ask === "difficulty";
    const schema = z
      .object({
        decision: z.enum(["accept", "reject"]),
        difficulty: DifficultySchema.optional(),
        reason: z.string().min(1).max(500).optional(),
      })
      .refine((v) => !(needsTier && v.decision === "accept" && !v.difficulty), {
        message: "accept on a difficulty ask needs a difficulty",
      });
    const prompt = buildRulingPrompt(request);
    const result = await callJson(deps, {
      purpose: PURPOSE_OF.adjudicate,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      schema,
      signal,
    });
    if (!result.ok) {
      deps.log({
        event: "dm.ruling.call-failed",
        requestId: request.requestId,
        kind: result.error.kind,
      });
      continue;
    }
    const { decision, difficulty, reason } = result.value;
    const submitted = await deps.gate.submit(
      sessionId,
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "intent",
        intent: {
          id: `ruling-${deps.newId()}`,
          kind: "ruling",
          actor: { kind: "ai:dm" },
          params: {
            requestId: request.requestId,
            decision,
            ...(needsTier && decision === "accept" ? { difficulty } : {}),
            ...(reason ? { reason } : {}),
          },
          source: "ai",
          commit: "confirmed",
        },
      },
    );
    if (submitted.ok) answered++;
    else {
      deps.log({
        event: "dm.ruling.refused",
        requestId: request.requestId,
        code: submitted.refusal.code,
      });
    }
  }
  return { answered };
}
