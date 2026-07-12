/**
 * Pinned metric definitions (spec 010 US4) — the ONLY metric semantics the
 * harness may implement, transcribed from contracts/metrics.md. Pure
 * arithmetic over hash lists: no DB, no engine — the deterministic CI floor
 * (T031) and every eval report stand on these functions computing exactly
 * what the contract says, forever.
 *
 * Matching is by content hash (a re-ingested identical passage still
 * counts); `unresolvable` items are EXCLUDED from every denominator and
 * surfaced as their own count — a stale answer key is a labeling problem to
 * fix, never a silent miss to absorb.
 */

export interface EvalItemInput {
  goldItemId: string;
  split: "tuning" | "heldout";
  /** The gold item's expected passage hashes. */
  expectedHashes: string[];
  /** The run's returned passage hashes, IN RANK ORDER. */
  resultHashes: string[];
  /** True when an expected passage no longer exists at the current generation. */
  unresolvable: boolean;
}

export interface SliceMetrics {
  items: number;
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
}

export interface EvalItemOutcome {
  goldItemId: string;
  split: "tuning" | "heldout";
  status: "hit" | "miss" | "unresolvable";
  /** 1-based rank of the FIRST returned expected passage; null on miss. */
  firstHitRank: number | null;
  /** Every position (1-based, ≤10 considered for nDCG) that hit. */
  hitRanks: number[];
}

export interface EvalMetrics {
  slices: { tuning: SliceMetrics | null; heldout: SliceMetrics | null };
  unresolvableCount: number;
  itemOutcomes: EvalItemOutcome[];
}

const NDCG_DEPTH = 10;

function outcomeOf(item: EvalItemInput): EvalItemOutcome {
  if (item.unresolvable) {
    return {
      goldItemId: item.goldItemId,
      split: item.split,
      status: "unresolvable",
      firstHitRank: null,
      hitRanks: [],
    };
  }
  const expected = new Set(item.expectedHashes);
  const hitRanks: number[] = [];
  item.resultHashes.forEach((hash, index) => {
    if (expected.has(hash)) hitRanks.push(index + 1);
  });
  return {
    goldItemId: item.goldItemId,
    split: item.split,
    status: hitRanks.length > 0 ? "hit" : "miss",
    firstHitRank: hitRanks[0] ?? null,
    hitRanks,
  };
}

/** nDCG@10, binary relevance (contracts/metrics.md): DCG over hit positions
 *  ≤ 10; IDCG = the ideal ordering (all |expected| relevants first, capped). */
function ndcgAt10(item: EvalItemInput, outcome: EvalItemOutcome): number {
  const dcg = outcome.hitRanks
    .filter((rank) => rank <= NDCG_DEPTH)
    .reduce((sum, rank) => sum + 1 / Math.log2(rank + 1), 0);
  const idealCount = Math.min(item.expectedHashes.length, NDCG_DEPTH);
  let idcg = 0;
  for (let position = 1; position <= idealCount; position++) {
    idcg += 1 / Math.log2(position + 1);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}

function sliceMetrics(pairs: Array<{ item: EvalItemInput; outcome: EvalItemOutcome }>): SliceMetrics | null {
  if (pairs.length === 0) return null;
  const n = pairs.length;
  const withinK = (k: number) =>
    pairs.filter(({ outcome }) => outcome.firstHitRank !== null && outcome.firstHitRank <= k).length / n;
  const mrr =
    pairs.reduce(
      (sum, { outcome }) => sum + (outcome.firstHitRank === null ? 0 : 1 / outcome.firstHitRank),
      0,
    ) / n;
  const ndcg = pairs.reduce((sum, pair) => sum + ndcgAt10(pair.item, pair.outcome), 0) / n;
  return { items: n, recallAt5: withinK(5), recallAt10: withinK(10), mrr, ndcgAt10: ndcg };
}

export function computeMetrics(items: EvalItemInput[]): EvalMetrics {
  const itemOutcomes = items.map(outcomeOf);
  const resolvable = items
    .map((item, i) => ({ item, outcome: itemOutcomes[i]! }))
    .filter(({ outcome }) => outcome.status !== "unresolvable");
  return {
    slices: {
      tuning: sliceMetrics(resolvable.filter(({ item }) => item.split === "tuning")),
      heldout: sliceMetrics(resolvable.filter(({ item }) => item.split === "heldout")),
    },
    unresolvableCount: itemOutcomes.filter((o) => o.status === "unresolvable").length,
    itemOutcomes,
  };
}
