import type { SessionProjections } from "@the-stacks/session-model";
import type { PriorTurn } from "./resume.js";

/** At most this many open followUps per party member. */
export const MAX_OPEN_FOLLOW_UPS = 6;

/** The action ids whose latest resolved action of an earlier turn may hold open followUps. */
export function priorActionIds(
  p: SessionProjections,
  thisBeat: readonly string[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of p.party) {
    const mine = p.actions
      .filter((a) => a.characterId === m.characterId)
      .sort((a, b) => b.declaredSeq - a.declaredSeq)[0];
    if (mine?.status !== "resolved") continue;
    if (thisBeat.includes(mine.actionId)) continue;
    out.set(m.characterId, mine.actionId);
  }
  return out;
}

/** Each party member's open followUps from its latest resolved action of an earlier turn. */
export function openFollowUps(
  p: SessionProjections,
  prior: readonly PriorTurn[], // newest first
  thisBeat: readonly string[],
): { characterId: string; text: string }[] {
  const out: { characterId: string; text: string }[] = [];
  for (const [characterId, actionId] of priorActionIds(p, thisBeat)) {
    for (const t of prior) {
      const cp = t.checkpoint;
      const reading = cp.interpret?.readings.find(
        (r) => r.actionId === actionId,
      );
      if (!reading) continue;
      for (const text of reading.followUps.slice(0, MAX_OPEN_FOLLOW_UPS)) {
        out.push({ characterId, text });
      }
      break;
    }
  }
  return out;
}
