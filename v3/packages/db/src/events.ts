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
