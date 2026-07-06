/**
 * Skeleton-check domain vocabulary — the shared language of the end-to-end
 * health check that exercises every seam of the system (api -> queue ->
 * worker -> ml -> pgvector -> readback). Pure domain code: no IO, no db
 * imports, so both api and worker can depend on it without cycles.
 *
 * The persistence side of these types lives in @stacks/db
 * (schema/skeleton-checks.ts, events.ts); the full lifecycle is documented in
 * specs/007-v3-skeleton/data-model.md.
 */
import { createHash } from "node:crypto";

/** Small fixed synthetic text shipped as a repo fixture (Principle I) — the
 * skeleton check never downloads or embeds operator/game content. */
export const SKELETON_CHECK_INPUT_TEXT =
  "the Stacks v3 walking skeleton: a fixed sentence crossing every seam.";

// The seams a check crosses, in pipeline order. Each one becomes an
// append-only row in skeleton_check_events (Principle IV), so a failed run
// tells you exactly which hop broke. The db CHECK constraint on
// skeleton_check_events.seam mirrors this list — change them together.
export const SEAMS = [
  "queued",
  "claimed",
  "inference",
  "vector_write",
  "vector_readback",
  "completed",
] as const;

export type Seam = (typeof SEAMS)[number];

// Run lifecycle; mirrored by the CHECK constraint on skeleton_check_runs.status.
export type SkeletonCheckStatus = "accepted" | "running" | "succeeded" | "failed";

// A failed run's terminal verdict (stored as jsonb on the run row). Only two
// of the four ErrorClasses can appear: by the time a check is running, the
// caller-side classes (unknown_thing/unsupported_type) are impossible.
export interface SkeletonCheckOutcome {
  class: "dependency_down" | "internal_fault";
  seam: Seam;
  message: string;
}

export interface DeriveVectorIdInput {
  inputText: string;
  provider: string;
  model: string;
  dimensions: number;
}

/**
 * Deterministic vector identity (FR-012): identical input+config always
 * derives the same id, making re-runs idempotent (data-model.md).
 *
 * The id is the skeleton_vectors primary key; the worker inserts with
 * ON CONFLICT DO NOTHING, so a re-run of the same input under the same
 * provider/model/dimensions is a no-op rather than a duplicate row. Changing
 * any config axis (FR-014's stamp) changes the hash, so vectors from
 * different models never collide. The material format below is therefore
 * part of the data contract — altering it orphans every existing row id.
 */
export function deriveVectorId(input: DeriveVectorIdInput): string {
  const material = `${input.inputText}\n${input.provider}/${input.model}/${input.dimensions}`;
  return createHash("sha256").update(material).digest("hex");
}
