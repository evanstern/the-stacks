import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { jobs } from "./jobs";
import { skeletonVectors } from "./skeleton-vectors";

/**
 * Storage for skeleton-check runs and their per-seam event trail. Two tables
 * with distinct write disciplines:
 *   - skeleton_check_runs: mutable head — one row per check, updated as the
 *     run progresses (status, outcome, timings).
 *   - skeleton_check_events: append-only history — the immutable record of
 *     each seam crossing (Principle IV). Sole writer: ../events.ts.
 * Domain vocabulary (statuses, seams, outcome shape) is defined in
 * @stacks/core skeleton-check.ts; lifecycle doc: specs/007-v3-skeleton/data-model.md.
 */
export const skeletonCheckRuns = pgTable(
  "skeleton_check_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // Every run is born from exactly one queue job; the FK ties the domain
    // record back to the transport that carried it.
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    status: text("status").notNull().default("accepted"),
    // The exact text embedded, denormalized onto the run so the record is
    // self-explanatory even if the fixture constant changes later.
    inputText: text("input_text").notNull(),
    // SkeletonCheckOutcome jsonb — populated only on failure; null on success.
    outcome: jsonb("outcome"),
    // Set once vector_write succeeds; the readback distance proves the vector
    // round-tripped through pgvector (should be ~0 for an identical query).
    vectorId: text("vector_id").references(() => skeletonVectors.id),
    readbackDistance: doublePrecision("readback_distance"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "skeleton_check_runs_status_check",
      sql`${table.status} IN ('accepted', 'running', 'succeeded', 'failed')`,
    ),
  ],
);

// Append-only BY CONSTRUCTION: no code path issues UPDATE/DELETE against this
// table — recordEvent in ../events.ts is the only writer. Treat rows as facts.
export const skeletonCheckEvents = pgTable(
  "skeleton_check_events",
  {
    // Identity bigint (not uuid): monotonic within the table, so ordering by
    // id gives arrival order without trusting timestamp resolution.
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    runId: uuid("run_id")
      .notNull()
      .references(() => skeletonCheckRuns.id),
    seam: text("seam").notNull(),
    ok: boolean("ok").notNull().default(true),
    detail: jsonb("detail").notNull().default({}),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Mirrors SEAMS in @stacks/core skeleton-check.ts — keep the two in sync.
    check(
      "skeleton_check_events_seam_check",
      sql`${table.seam} IN ('queued', 'claimed', 'inference', 'vector_write', 'vector_readback', 'completed')`,
    ),
    // The read path is "all events for a run, in order" — (run_id, id) serves
    // that as a single index range scan.
    index("skeleton_check_events_run_id_id_idx").on(table.runId, table.id),
  ],
);
