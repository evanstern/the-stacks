import type { JobView } from "./job-view.ts";

export interface SeqIndex {
  /** The id of the job that wrote `seq`, or null. A seq claimed twice maps to the newer job. */
  jobFor(seq: number): string | null;
}

export function buildSeqIndex(views: readonly JobView[]): SeqIndex {
  const map = new Map<number, { id: string; at: number }>();
  for (const v of views) {
    const at = Date.parse(v.createdAt);
    const stamp = Number.isFinite(at) ? at : 0;
    for (const seq of v.wroteSeqs) {
      const held = map.get(seq);
      if (!held || stamp >= held.at) map.set(seq, { id: v.id, at: stamp });
    }
  }
  return { jobFor: (seq) => map.get(seq)?.id ?? null };
}
