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

/** Zero segments when the transcript has no `scene.changed` row. */
export function segment(
  transcript: readonly StoredEvent[],
  ledger: readonly LedgerRow[],
): Segment[] {
  if (!hasScene(transcript)) return [];
  const rows = [...transcript].sort((a, b) => a.seq - b.seq);
  const out: Segment[] = [];
  let current: StoredEvent[] = [];
  const close = (narrationSeq: number | null) => {
    const first = current[0];
    const last = current[current.length - 1];
    if (!first || !last) return;
    out.push({
      index: out.length,
      narrationSeq,
      fromSeq: first.seq,
      toSeq: last.seq,
      rows: current,
      ledger: ledger.filter((l) => l.seq >= first.seq && l.seq <= last.seq),
    });
    current = [];
  };
  for (const row of rows) {
    current.push(row);
    if (isDmNarration(row)) close(row.seq);
  }
  if (current.some((r) => r.type === "talk" || isDeedRow(r, rows))) close(null);
  return out;
}
