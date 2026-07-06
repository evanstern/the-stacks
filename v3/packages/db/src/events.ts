/**
 * Seam-event recording for skeleton-check runs (Principle IV: the system
 * must show its work). Every hop of a run — queued, claimed, inference,
 * vector_write, vector_readback, completed — lands here as one immutable
 * row, so the API's run-status read can replay exactly what happened and
 * where a failure occurred. Seam names come from @stacks/core (SEAMS); the table
 * lives in schema/skeleton-checks.ts.
 */
import type { Seam } from "@stacks/core";

import type { Database } from "./client";
import { skeletonCheckEvents } from "./schema/skeleton-checks";

export type { Seam };

export interface RecordEventInput {
  runId: string;
  seam: Seam;
  ok?: boolean;
  detail?: Record<string, unknown>;
  durationMs?: number;
}

/**
 * The only write path onto skeleton_check_events (data-model.md: append-only,
 * no UPDATE/DELETE in code) — Principle IV's per-seam trail.
 *
 * The append-only guarantee is BY CONSTRUCTION, not by trigger or grant:
 * keeping this function the sole writer is the invariant. If you find
 * yourself wanting to update or delete an event row, the design answer is
 * to append a correcting event instead.
 */
export async function recordEvent(db: Database, input: RecordEventInput): Promise<void> {
  await db.insert(skeletonCheckEvents).values({
    runId: input.runId,
    seam: input.seam,
    ok: input.ok ?? true,
    detail: input.detail ?? {},
    durationMs: input.durationMs,
  });
}
