import type { SessionProjections } from "@the-stacks/session-model";

/**
 * Pure reads shared by the floor job, its arming and its reconcile
 * (specs/049-turn-floor contracts/floor-jobs.md). No gate access, no writes.
 */

type ActionView = SessionProjections["actions"][number];

/** True when the AI DM holds the seat; floor checks run only then (FR-013). */
export const isAiSeat = (p: SessionProjections): boolean =>
  p.gate.seat.kind === "ai";

/** User ids of the humans who control a party member, sorted. */
export function partyHumans(p: SessionProjections): string[] {
  return [
    ...new Set(
      p.party.flatMap((m) =>
        m.controller.kind === "player" ? [m.controller.userId] : [],
      ),
    ),
  ].sort();
}

/** The active human in turn mode, or null (free mode, an AI actor, or no actor). */
export function activeHuman(p: SessionProjections): string | null {
  if (p.tableMode.mode !== "turn") return null;
  const actor = p.tableMode.activeActor;
  return actor.startsWith("ai:") || actor === "system" ? null : actor;
}

/** The active human when they are absent from `present`, else null. */
export function absentHolder(
  p: SessionProjections,
  present: readonly string[],
): string | null {
  const holder = activeHuman(p);
  return holder !== null && !present.includes(holder) ? holder : null;
}

/** An open party action in a party with two or more humans (the only stall candidates). */
export const isStallCandidate = (
  p: SessionProjections,
  action: ActionView,
): boolean =>
  action.scope === "party" &&
  (action.status === "declared" || action.status === "discussed") &&
  partyHumans(p).length >= 2;

/** Seq of the latest comment on the action (any stance), or 0 when none. */
export const latestStanceSeq = (action: ActionView): number =>
  action.comments.reduce((max, c) => Math.max(max, c.seq), 0);
