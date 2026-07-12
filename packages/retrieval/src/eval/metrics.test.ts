/**
 * T024 (010 US4): the pinned metric definitions (contracts/metrics.md),
 * TDD'd from hand-computed examples BEFORE metrics.ts exists. These numbers
 * are the contract: if an implementation change moves any of them, it isn't
 * a refactor — it's a silent redefinition, which the contract forbids.
 */
import { describe, expect, it } from "vitest";

import { computeMetrics, type EvalItemInput } from "./metrics";

const item = (
  split: "tuning" | "heldout",
  expectedHashes: string[],
  resultHashes: string[],
  unresolvable = false,
): EvalItemInput => ({ goldItemId: `g-${Math.abs(hashCode(expectedHashes.join()))}`, split, expectedHashes, resultHashes, unresolvable });

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe("computeMetrics — contracts/metrics.md, hand-computed", () => {
  it("recall@k and MRR over three resolvable items (ranks 1, 7, none)", () => {
    const results = computeMetrics([
      item("tuning", ["A"], ["A", "x", "x", "x", "x", "x", "x", "x", "x", "x"]), // rank 1
      item("tuning", ["B"], ["x", "x", "x", "x", "x", "x", "B", "x", "x", "x"]), // rank 7
      item("tuning", ["C"], ["x", "x", "x", "x", "x", "x", "x", "x", "x", "x"]), // never
    ]);
    const tuning = results.slices.tuning!;
    expect(tuning.items).toBe(3);
    // recall@5 = |{rank ≤ 5}| / 3 = 1/3
    expect(tuning.recallAt5).toBeCloseTo(1 / 3, 10);
    // recall@10 = 2/3
    expect(tuning.recallAt10).toBeCloseTo(2 / 3, 10);
    // MRR = (1/1 + 1/7 + 0) / 3
    expect(tuning.mrr).toBeCloseTo((1 + 1 / 7 + 0) / 3, 10);
  });

  it("nDCG@10 with two expected passages at positions 2 and 5", () => {
    const results = computeMetrics([
      item("tuning", ["h1", "h2"], ["x", "h1", "x", "x", "h2", "x", "x", "x", "x", "x"]),
    ]);
    // DCG  = 1/log2(2+1) + 1/log2(5+1)
    // IDCG = 1/log2(1+1) + 1/log2(2+1)   (both relevants ranked first, ideally)
    const dcg = 1 / Math.log2(3) + 1 / Math.log2(6);
    const idcg = 1 / Math.log2(2) + 1 / Math.log2(3);
    expect(results.slices.tuning!.ndcgAt10).toBeCloseTo(dcg / idcg, 10);
  });

  it("unresolvable items leave every denominator and are counted separately", () => {
    const results = computeMetrics([
      item("tuning", ["A"], ["A"]), // rank 1
      item("tuning", ["gone"], [], true), // swept expected passage
    ]);
    const tuning = results.slices.tuning!;
    expect(tuning.items).toBe(1); // only the resolvable one
    expect(tuning.recallAt5).toBe(1);
    expect(tuning.mrr).toBe(1);
    expect(results.unresolvableCount).toBe(1);
  });

  it("slices never blend: tuning and heldout report separately (FR-013)", () => {
    const results = computeMetrics([
      item("tuning", ["A"], ["A"]),
      item("heldout", ["B"], ["x", "x", "x", "x", "x", "x", "x", "x", "x", "x"]),
    ]);
    expect(results.slices.tuning!.recallAt10).toBe(1);
    expect(results.slices.heldout!.recallAt10).toBe(0);
  });

  it("an empty slice reports null, not fake zeros", () => {
    const results = computeMetrics([item("tuning", ["A"], ["A"])]);
    expect(results.slices.heldout).toBeNull();
  });

  it("multi-expected items hit on the FIRST matching hash for rank purposes", () => {
    const results = computeMetrics([
      item("tuning", ["h1", "h2"], ["x", "h2", "h1", "x", "x", "x", "x", "x", "x", "x"]),
    ]);
    // First hit at position 2 (h2) — rank_i = 2 regardless of h1 later.
    expect(results.slices.tuning!.mrr).toBeCloseTo(1 / 2, 10);
  });

  it("per-item outcomes carry status, firstHitRank, and hit set", () => {
    const results = computeMetrics([
      item("tuning", ["A"], ["x", "A"]),
      item("tuning", ["B"], ["x", "x"]),
      item("heldout", ["C"], [], true),
    ]);
    expect(results.itemOutcomes.map((o) => o.status)).toEqual(["hit", "miss", "unresolvable"]);
    expect(results.itemOutcomes[0]!.firstHitRank).toBe(2);
    expect(results.itemOutcomes[1]!.firstHitRank).toBeNull();
  });
});
