/**
 * T005 (010 Foundational): fusion math, TDD'd before it exists — every
 * expectation below is hand-computed from research R1's formulas, because
 * the deterministic CI floor (T031) ultimately rests on this arithmetic
 * being exactly what the contract says.
 *
 * Shape contract: candidates arrive best-first per signal with their RAW
 * scores; fusion owns ranks and combination. Ties break by chunkId
 * (lexicographic) so identical inputs can never produce two orderings —
 * receipts and eval metrics need determinism, not luck.
 */
import { describe, expect, it } from "vitest";

import { fuse, type SignalCandidate } from "./fusion";

const fts = (...entries: Array<[string, number]>): SignalCandidate[] =>
  entries.map(([chunkId, score]) => ({ chunkId, score }));

describe("fuse — rrf", () => {
  const config = { fusion: "rrf" as const, rrfK: 60, weightAlpha: 0.5 };

  it("computes reciprocal-rank scores across both lists (hand-computed)", () => {
    // fts order: A,B,C · vector order: B,D
    // A: 1/(60+1)            = 0.016393…
    // B: 1/(60+2) + 1/(60+1) = 0.032522…
    // C: 1/(60+3)            = 0.015873…
    // D: 1/(60+2)            = 0.016129…
    const ranked = fuse(config, fts(["A", 3], ["B", 2], ["C", 1]), fts(["B", 0.9], ["D", 0.6]));
    expect(ranked.map((r) => r.chunkId)).toEqual(["B", "A", "D", "C"]);
    expect(ranked[0]!.fusedScore).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(ranked[1]!.fusedScore).toBeCloseTo(1 / 61, 10);
  });

  it("carries each signal's raw score and position through (receipts need them)", () => {
    const ranked = fuse(config, fts(["A", 3.5]), fts(["A", 0.8], ["B", 0.2]));
    const a = ranked.find((r) => r.chunkId === "A")!;
    expect(a.ftsScore).toBe(3.5);
    expect(a.vectorScore).toBe(0.8);
    const b = ranked.find((r) => r.chunkId === "B")!;
    expect(b.ftsScore).toBeNull();
    expect(b.vectorScore).toBe(0.2);
  });

  it("breaks exact ties lexicographically by chunkId (determinism)", () => {
    // Symmetric appearance: both at rank 1 in one list and rank 2 in the other.
    const ranked = fuse(config, fts(["B", 2], ["A", 1]), fts(["A", 0.9], ["B", 0.8]));
    expect(ranked[0]!.fusedScore).toBeCloseTo(ranked[1]!.fusedScore, 12);
    expect(ranked.map((r) => r.chunkId)).toEqual(["A", "B"]);
  });

  it("handles one empty signal (the other drives the ranking alone)", () => {
    const ranked = fuse(config, fts(), fts(["X", 0.4], ["Y", 0.2]));
    expect(ranked.map((r) => r.chunkId)).toEqual(["X", "Y"]);
  });
});

describe("fuse — weighted", () => {
  const config = { fusion: "weighted" as const, rrfK: 60, weightAlpha: 0.5 };

  it("min-max normalizes each signal then combines by alpha (hand-computed)", () => {
    // fts raw: A=2.0 B=1.0 C=0.5 → normalized A=1, B=1/3, C=0
    // vector raw: B=0.9 D=0.6   → normalized B=1, D=0
    // fused(α=.5): B=.5·1+.5·(1/3)=0.6667 · A=0.5 · C=0 · D=0 (tie → C,D)
    const ranked = fuse(config, fts(["A", 2.0], ["B", 1.0], ["C", 0.5]), fts(["B", 0.9], ["D", 0.6]));
    expect(ranked.map((r) => r.chunkId)).toEqual(["B", "A", "C", "D"]);
    expect(ranked[0]!.fusedScore).toBeCloseTo(0.5 + 0.5 / 3, 10);
    expect(ranked[1]!.fusedScore).toBeCloseTo(0.5, 10);
  });

  it("alpha weights the vector signal (alpha=1 means vector only)", () => {
    const ranked = fuse(
      { ...config, weightAlpha: 1 },
      fts(["A", 99]),
      fts(["B", 0.9], ["A", 0.1]),
    );
    expect(ranked[0]!.chunkId).toBe("B");
  });

  it("a single-candidate signal normalizes to 1.0 (max==min is 'the best we saw')", () => {
    const ranked = fuse(config, fts(["A", 7]), fts(["B", 0.5]));
    // A: .5·0(vector absent)+.5·1 = 0.5 · B: .5·1+.5·0 = 0.5 → tie → A first
    expect(ranked.map((r) => r.chunkId)).toEqual(["A", "B"]);
    expect(ranked[0]!.fusedScore).toBeCloseTo(0.5, 10);
  });
});
