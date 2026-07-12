/**
 * Fusion — the pure heart of hybrid retrieval (research R1). Two signals
 * propose candidates best-first with raw scores; this module combines them
 * into ONE ranking. No DB, no IO: the deterministic CI floor (T031) and the
 * eval harness lean on this file being pure arithmetic.
 *
 * Why RRF is the default: ts_rank_cd (unbounded, corpus-dependent) and
 * cosine similarity ([-1,1]) are incomparable scales. RRF ignores scores
 * entirely — only RANKS matter — so it needs no per-corpus calibration.
 * Weighted-sum (min-max normalized per signal, α on the vector side) is the
 * eval rival the closing report measures against; it lives here so both
 * strategies share one candidate shape and one tie-break rule.
 *
 * Determinism: exact fused-score ties break lexicographically by chunkId.
 * Receipts and metrics must never depend on Map iteration order.
 */
import type { FusionStrategy } from "./config";

export interface SignalCandidate {
  chunkId: string;
  /** The signal's RAW score (ts_rank_cd, or cosine similarity). */
  score: number;
}

export interface FusedCandidate {
  chunkId: string;
  /** Raw per-signal scores, null when the signal didn't propose the chunk. */
  ftsScore: number | null;
  vectorScore: number | null;
  fusedScore: number;
}

interface FusionKnobs {
  fusion: FusionStrategy;
  rrfK: number;
  weightAlpha: number;
}

/** Min-max normalize a best-first list's scores to [0,1]; a single-candidate
 *  list (max == min) normalizes to 1.0 — "the best this signal saw". */
function normalized(list: SignalCandidate[]): Map<string, number> {
  const out = new Map<string, number>();
  if (list.length === 0) return out;
  const scores = list.map((c) => c.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  for (const c of list) {
    out.set(c.chunkId, max === min ? 1 : (c.score - min) / (max - min));
  }
  return out;
}

export function fuse(
  knobs: FusionKnobs,
  ftsCandidates: SignalCandidate[],
  vectorCandidates: SignalCandidate[],
): FusedCandidate[] {
  const ftsRaw = new Map(ftsCandidates.map((c) => [c.chunkId, c.score]));
  const vectorRaw = new Map(vectorCandidates.map((c) => [c.chunkId, c.score]));
  const ids = new Set([...ftsRaw.keys(), ...vectorRaw.keys()]);

  const fusedScoreOf = (() => {
    if (knobs.fusion === "rrf") {
      // rank position is 1-based within each signal's best-first list;
      // absence contributes nothing (the standard RRF missing-list rule).
      const ftsRank = new Map(ftsCandidates.map((c, i) => [c.chunkId, i + 1]));
      const vectorRank = new Map(vectorCandidates.map((c, i) => [c.chunkId, i + 1]));
      return (id: string) => {
        let score = 0;
        const fr = ftsRank.get(id);
        if (fr !== undefined) score += 1 / (knobs.rrfK + fr);
        const vr = vectorRank.get(id);
        if (vr !== undefined) score += 1 / (knobs.rrfK + vr);
        return score;
      };
    }
    const ftsNorm = normalized(ftsCandidates);
    const vectorNorm = normalized(vectorCandidates);
    return (id: string) =>
      knobs.weightAlpha * (vectorNorm.get(id) ?? 0) +
      (1 - knobs.weightAlpha) * (ftsNorm.get(id) ?? 0);
  })();

  return [...ids]
    .map((chunkId) => ({
      chunkId,
      ftsScore: ftsRaw.get(chunkId) ?? null,
      vectorScore: vectorRaw.get(chunkId) ?? null,
      fusedScore: fusedScoreOf(chunkId),
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore || a.chunkId.localeCompare(b.chunkId));
}
