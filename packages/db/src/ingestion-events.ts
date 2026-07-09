/**
 * Ingestion event recording (008 FR-007/FR-010, contracts/events.md) — the
 * pipeline's authoritative history. Every stage transition of every job lands
 * here as one immutable row, so a claim ticket can replay exactly what
 * happened, retries included (Principle IV: failures are legible).
 *
 * The append-only guarantee is BY CONSTRUCTION, not by trigger or grant —
 * the same invariant events.ts pins for skeleton_check_events: this function
 * is the ONLY writer of ingestion_events, and no UPDATE/DELETE path may ever
 * exist. If you find yourself wanting to change an event row, the design
 * answer is to append a correcting event instead.
 */
import type { Database } from "./client";
import { ingestionEvents } from "./schema/ingestion";

// Mirrors the CHECK constraints on the table — change them together
// (contracts/events.md is the vocabulary contract both derive from).
export const INGESTION_STAGES = [
  "intake",
  "expand",
  "detect",
  "extract",
  "transform",
  "chunk",
  "embed",
  "index",
  "commit",
] as const;
export type IngestionStage = (typeof INGESTION_STAGES)[number];

export const INGESTION_EVENT_KINDS = ["started", "completed", "failed", "skipped"] as const;
export type IngestionEventKind = (typeof INGESTION_EVENT_KINDS)[number];

export interface RecordIngestionEventInput {
  /** At least one of sourceId/batchId is required (table CHECK): an event
   * belongs to a source, a batch (expand stage), or both. */
  sourceId?: string;
  batchId?: string;
  stage: IngestionStage;
  event: IngestionEventKind;
  ok?: boolean;
  /** Scrubbed: counts, reasons, durations — never content bytes or secrets. */
  detail?: Record<string, unknown>;
  durationMs?: number;
}

export async function recordIngestionEvent(
  db: Database,
  input: RecordIngestionEventInput,
): Promise<void> {
  await db.insert(ingestionEvents).values({
    sourceId: input.sourceId,
    batchId: input.batchId,
    stage: input.stage,
    event: input.event,
    // `failed` defaults ok:false; everything else defaults ok:true — callers
    // only override when a completed stage still carries a warning-ish signal.
    ok: input.ok ?? input.event !== "failed",
    detail: input.detail ?? {},
    durationMs: input.durationMs,
  });
}
