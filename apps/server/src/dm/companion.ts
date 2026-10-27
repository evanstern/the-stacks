import {
  type Proposal,
  type Proposer,
  RefIdSchema,
  type SessionProjections,
} from "@the-stacks/session-model";
import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type { Gate } from "../gate/index.js";
import type { CompanionJobInput } from "./jobs.js";
import { callJson } from "./pipeline/call.js";
import type { ModelCallRecord } from "./pipeline/context.js";
import { buildCompanionPrompt, PROMPT_VERSION } from "./prompts/companion.js";
import { PURPOSE_OF } from "./purposes.js";
import type { SceneSeed } from "./seed/schema.js";
import { playerFacingSeed } from "./seed/views.js";

/**
 * AI companions (contracts/companions.md): party members whose controller is
 * `ai-companion`. A companion passes through the same permission matrix and
 * commit authority as a human player. This module and `nodes/resolve.ts` and
 * `chronicle.ts` are the only files under `dm/` that call `gate.submit`.
 */

export const CompanionOutput = z.object({
  say: z.string().min(1).max(400).nullable(),
  comment: z
    .object({
      actionId: RefIdSchema,
      stance: z.enum(["approve", "object", "comment"]),
      text: z.string().min(1).max(400),
    })
    .nullable(),
  act: z
    .object({ text: z.string().min(1).max(400), commit: z.boolean() })
    .nullable(),
  /** One decision per own open action (specs/036-companion-react FR-010). */
  pending: z
    .array(
      z.object({
        actionId: RefIdSchema,
        decision: z.literal("commit"),
        text: z.string().min(1).max(400).nullable(),
      }),
    )
    .max(4),
});
export type CompanionOutput = z.infer<typeof CompanionOutput>;

/** The act that replaces a null act for the active companion in turn mode. */
export const HOLD_ACT_TEXT = "holds position and watches for an opening";

export interface CompanionSubmission {
  kind: string;
  ok: boolean;
  code: string | null;
}

export interface CompanionPlay {
  companionId: string;
  status: "played" | "skipped" | "invalid-output" | "error";
  submissions: CompanionSubmission[];
}

export interface CompanionResult {
  plays: CompanionPlay[];
  calls: ModelCallRecord[];
}

export interface CompanionDeps {
  gateway: Pick<Gateway, "chat">;
  gate: Pick<Gate, "submit">;
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  loadSeed: (seedId: string) => SceneSeed;
  /** Ends a `hold`: upserts the session's queued turn job with forceResolve. */
  enqueueTurnForced: (sessionId: string) => Promise<unknown>;
  /** True while this worker holds the lease. */
  fence: () => Promise<boolean>;
  log: (line: Record<string, unknown>) => void;
}

export const companionActor = (id: string) => `ai:companion:${id}` as const;

function nextActionId(p: SessionProjections, companionId: string): string {
  const prefix = `act-${companionId}-`;
  let n = 0;
  for (const a of p.actions) {
    if (a.actionId.startsWith(prefix)) n += 1;
  }
  let id = `${prefix}${n + 1}`;
  const taken = new Set(p.actions.map((a) => a.actionId));
  while (taken.has(id)) {
    n += 1;
    id = `${prefix}${n + 1}`;
  }
  return id.slice(0, 64);
}

type ActionView = SessionProjections["actions"][number];

const isOpen = (a: ActionView) =>
  a.status === "declared" || a.status === "discussed";

/** The companion's own open actions, oldest first. */
function ownOpenActions(
  p: SessionProjections,
  companionId: string,
): ActionView[] {
  return p.actions
    .filter((a) => a.actor === companionActor(companionId) && isOpen(a))
    .sort((a, b) => a.declaredSeq - b.declaredSeq);
}

/** FR-009: a human comment newer than the companion's own last event on the action. */
function hasUnansweredReaction(a: ActionView, companionId: string): boolean {
  const me = companionActor(companionId);
  const ownLast = Math.max(
    a.declaredSeq,
    ...a.comments.filter((c) => c.actor === me).map((c) => c.seq),
  );
  return a.comments.some((c) => !c.actor.startsWith("ai:") && c.seq > ownLast);
}

function isActive(p: SessionProjections, companionId: string): boolean {
  return (
    p.tableMode.mode === "turn" &&
    p.tableMode.activeActor === companionActor(companionId)
  );
}

export async function runCompanionJob(
  deps: CompanionDeps,
  job: { id: string; input: CompanionJobInput },
  signal: AbortSignal,
): Promise<CompanionResult> {
  const { sessionId, companions, reason } = job.input;
  const plays: CompanionPlay[] = [];
  const calls: ModelCallRecord[] = [];

  for (const companionId of companions) {
    if (signal.aborted || !(await deps.fence())) break;
    const projections = await deps.loadProjections(sessionId);
    const member = projections.party.find(
      (m) =>
        m.characterId === companionId &&
        m.controller.kind === "ai-companion" &&
        m.controller.actor === companionActor(companionId),
    );
    const life = member?.combatant?.lifeState;
    if (
      !member ||
      !projections.scene ||
      life === "dead" ||
      life === "unconscious" ||
      life === "stable"
    ) {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }
    let seed: SceneSeed;
    try {
      seed = deps.loadSeed(projections.scene.sceneId);
    } catch {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }

    const ownOpen = ownOpenActions(projections, companionId);
    if (
      reason === "react" &&
      !ownOpen.some((a) => hasUnansweredReaction(a, companionId))
    ) {
      plays.push({ companionId, status: "skipped", submissions: [] });
      continue;
    }

    const active = isActive(projections, companionId);
    const turnMode = projections.tableMode.mode === "turn";
    const prompt = buildCompanionPrompt({
      seed: playerFacingSeed(seed),
      projections,
      characterId: companionId,
      active,
      ownOpenActionIds: ownOpen.map((a) => a.actionId),
    });
    const result = await callJson(deps, {
      purpose: PURPOSE_OF.companion,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      signal,
      schema: CompanionOutput,
    });
    calls.push(...result.calls);

    let output: CompanionOutput;
    let playStatus: CompanionPlay["status"] = "played";
    if (result.ok) {
      output = result.value;
    } else if (
      result.error.kind === "invalid-output" &&
      ((active && turnMode) || ownOpen.length > 0)
    ) {
      // The active companion must still advance the turn, and an open action
      // must still get its default decision (FR-012).
      output = { say: null, comment: null, act: null, pending: [] };
      if (!(active && turnMode)) playStatus = "invalid-output";
    } else {
      plays.push({
        companionId,
        status:
          result.error.kind === "invalid-output" ? "invalid-output" : "error",
        submissions: [],
      });
      continue;
    }

    // A new act is dropped while the companion had an open action: the run
    // addresses that action first (FR-013).
    if (ownOpen.length > 0 && output.act !== null) {
      deps.log({
        event: "dm.companion.act-dropped",
        jobId: job.id,
        companionId,
        openActionIds: ownOpen.map((a) => a.actionId),
      });
      output = { ...output, act: null };
    }

    // The active companion in turn mode MUST act and commit. With an open
    // action of its own it commits that action instead (FR-014).
    if (
      active &&
      turnMode &&
      ownOpen.length === 0 &&
      (output.act === null || !output.act.commit)
    ) {
      output = {
        ...output,
        act: { text: output.act?.text ?? HOLD_ACT_TEXT, commit: true },
      };
    }

    const submissions: CompanionSubmission[] = [];
    const proposer: Proposer = {
      kind: "ai",
      actor: companionActor(companionId),
    };
    const send = async (proposal: Proposal): Promise<boolean> => {
      if (!(await deps.fence())) return false;
      const res = await deps.gate.submit(sessionId, proposer, proposal);
      submissions.push({
        kind: proposal.kind,
        ok: res.ok,
        code: res.ok ? null : res.refusal.code,
      });
      if (!res.ok) {
        deps.log({
          event: "dm.companion.refused",
          jobId: job.id,
          companionId,
          kind: proposal.kind,
          code: res.refusal.code,
        });
      }
      return res.ok;
    };

    if (output.say !== null) {
      await send({
        kind: "talk",
        summary: null,
        rationale: null,
        talk: { text: output.say, channel: "ic", characterId: companionId },
        visibility: "public",
      });
    }
    if (output.comment !== null) {
      const open = projections.actions.find(
        (a) =>
          a.actionId === output.comment?.actionId && a.status !== "resolved",
      );
      if (open) {
        await send({
          kind: "action.comment",
          summary: null,
          rationale: null,
          comment: {
            actionId: open.actionId,
            stance: output.comment.stance,
            text: output.comment.text,
          },
        });
      }
    }
    // One decision per own open action; the default is `commit` (FR-012). In
    // turn mode only the active companion commits (FR-014).
    if (!turnMode || active) {
      const decided = new Set(
        output.pending
          .filter((d) => ownOpen.some((a) => a.actionId === d.actionId))
          .map((d) => d.actionId),
      );
      for (const open of ownOpen) {
        if (!decided.has(open.actionId)) {
          deps.log({
            event: "dm.companion.default-decision",
            jobId: job.id,
            companionId,
            actionId: open.actionId,
            decision: "commit",
          });
        }
        await send({
          kind: "action.commit",
          summary: null,
          rationale: null,
          actionId: open.actionId,
        });
      }
    }
    if (output.act !== null) {
      const actionId = nextActionId(projections, companionId);
      const declared = await send({
        kind: "action.declare",
        summary: null,
        rationale: null,
        action: {
          actionId,
          characterId: companionId,
          scope: "character",
          text: output.act.text,
        },
      });
      if (declared && output.act.commit) {
        await send({
          kind: "action.commit",
          summary: null,
          rationale: null,
          actionId,
        });
      }
    }
    plays.push({ companionId, status: playStatus, submissions });
  }

  if (reason === "hold" && !signal.aborted) {
    await deps.enqueueTurnForced(sessionId);
  }
  return { plays, calls };
}
