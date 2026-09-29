import type { RetrievedPassage } from "../../library/retrieve.js";
import type { ResolvedQuestion } from "./load.js";

/**
 * Span-overlap scoring (research R4, contract invariant 1): a passage hits
 * a question when its book matches an expected target and the two spans
 * overlap by at least half the target's length. `passages` is already
 * best-first, so the first hit is the rank.
 */
export function scoreQuestion(
  q: ResolvedQuestion,
  passages: RetrievedPassage[],
): { rank: number | null } {
  for (const passage of passages) {
    const hit = q.targets.some((target) => {
      if (passage.anchor.book !== target.doc) return false;
      const overlap =
        Math.min(passage.anchor.end, target.end) -
        Math.max(passage.anchor.start, target.start);
      return overlap >= 0.5 * (target.end - target.start);
    });
    if (hit) return { rank: passage.rank };
  }
  return { rank: null };
}

/** recall@1/5/10 and MRR@10 over a set of ranks (contract invariant 2). */
export function summarize(ranks: (number | null)[]): {
  recall1: number;
  recall5: number;
  recall10: number;
  mrr10: number;
} {
  const n = ranks.length;
  if (n === 0) return { recall1: 0, recall5: 0, recall10: 0, mrr10: 0 };
  const recallAt = (limit: number) =>
    ranks.filter((r) => r !== null && r <= limit).length / n;
  const mrr10 =
    ranks.reduce<number>(
      (sum, r) => sum + (r !== null && r <= 10 ? 1 / r : 0),
      0,
    ) / n;
  return {
    recall1: recallAt(1),
    recall5: recallAt(5),
    recall10: recallAt(10),
    mrr10,
  };
}
