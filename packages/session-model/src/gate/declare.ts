import { type Intent, IntentSchema } from "@the-stacks/intent";
import type { z } from "zod";
import type { ActionDeclaredV1 } from "../events/actions.js";
import type { SessionProjections } from "../projections/types.js";
import { actorOf, type Proposer } from "./proposals.js";
import { controls } from "./roles.js";

export type DeclareResult =
  | { ok: true; intent: Intent }
  | { ok: false; message: string };

/**
 * FR-026: the pure envelope of an `action.declare` as a `declared` `attempt` Intent. The
 * gate validates with `IntentSchema` and plans exactly today's rows (FR-027).
 */
export function declareIntent(
  action: z.infer<typeof ActionDeclaredV1>,
  proposer: Proposer,
  p: SessionProjections,
): DeclareResult {
  const who = actorOf(proposer);
  const characterId =
    action.characterId ??
    p.party.find((m) => controls(p, proposer, m.characterId))?.characterId;
  const ai = proposer.kind === "ai";
  const actor =
    characterId === undefined
      ? null
      : ai
        ? ({ kind: "companion", id: characterId } as const)
        : ({ kind: "pc", id: characterId } as const);
  if (actor === null) {
    return { ok: false, message: `${who} controls no party member` };
  }
  const parsed = IntentSchema.safeParse({
    id: action.actionId,
    kind: "attempt",
    actor,
    params: { scope: action.scope },
    text: action.text,
    source: ai ? "ai" : "composer",
    commit: "declared",
  });
  return parsed.success
    ? { ok: true, intent: parsed.data }
    : { ok: false, message: parsed.error.issues[0]?.message ?? "invalid" };
}
