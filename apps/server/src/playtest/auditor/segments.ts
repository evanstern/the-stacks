import type { LedgerRow, StoredEvent } from "@the-stacks/session-model";
import { isDeedRow } from "../../dm/deeds.js";

/**
 * Transcript segments (specs/032-playtest-harness contracts/auditor.md
 * "Segments"). Each DM narration closes one segment; rows after the last
 * narration form a tail segment only when they include a `talk` row or a deed carrier.
 */

export interface Segment {
  /** 0-based position; the tail segment is last. */
  index: number;
  /** The closing narration's seq; null for the tail segment. */
  narrationSeq: number | null;
  fromSeq: number;
  toSeq: number;
  rows: StoredEvent[];
  /** Ledger rows whose seq falls inside the segment. */
  ledger: LedgerRow[];
}

export function isDmNarration(row: StoredEvent): boolean {
  return row.type === "narration" && row.actor === "ai:dm";
}

/** True when the transcript holds a `scene.changed` row. */
export function hasScene(transcript: readonly StoredEvent[]): boolean {
  return transcript.some((r) => r.type === "scene.changed");
}

/** Spec 115: narration seq → its job's facts window end. */
export function narrationCuts(
  jobs: readonly { factsThrough?: number | null; narrationSeqs?: number[] }[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const j of jobs) {
    if (typeof j.factsThrough !== "number") continue;
    for (const n of j.narrationSeqs ?? []) out.set(n, j.factsThrough);
  }
  return out;
}

/**
 * Zero segments when the transcript has no `scene.changed` row. Narration k at seq N closes the
 * non-narration rows with seq in (cut[k-1], cut[k]], where cut[k] is its facts window end
 * clamped to [cut[k-1], N-1]; absent cuts give N-1 (spec 115).
 */
export function segment(
  transcript: readonly StoredEvent[],
  ledger: readonly LedgerRow[],
  cuts: ReadonlyMap<number, number> = new Map(),
): Segment[] {
  if (!hasScene(transcript)) return [];
  const rows = [...transcript].sort((a, b) => a.seq - b.seq);
  const others = rows.filter((r) => !isDmNarration(r));
  const out: Segment[] = [];
  let prevCut = 0;
  let used = 0; // others consumed so far (they are seq-ordered)
  for (const n of rows.filter(isDmNarration)) {
    const cut = Math.min(
      Math.max(cuts.get(n.seq) ?? n.seq - 1, prevCut),
      n.seq - 1,
    );
    const seg: StoredEvent[] = [];
    while (used < others.length && (others[used] as StoredEvent).seq <= cut) {
      const r = others[used++] as StoredEvent;
      if (r.seq > prevCut) seg.push(r);
    }
    prevCut = cut;
    seg.push(n);
    out.push(build(out.length, n.seq, seg, ledger));
  }
  const tail = others.slice(used).filter((r) => r.seq > prevCut);
  if (tail.some((r) => r.type === "talk" || isDeedRow(r, rows))) {
    out.push(build(out.length, null, tail, ledger));
  }
  return out;
}

function build(
  index: number,
  narrationSeq: number | null,
  rows: StoredEvent[],
  ledger: readonly LedgerRow[],
): Segment {
  const seqs = new Set(rows.map((r) => r.seq));
  return {
    index,
    narrationSeq,
    fromSeq: (rows[0] as StoredEvent).seq,
    toSeq: (rows[rows.length - 1] as StoredEvent).seq,
    rows,
    ledger: ledger.filter((l) => seqs.has(l.seq)),
  };
}
