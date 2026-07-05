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

export const skeletonCheckRuns = pgTable(
  "skeleton_check_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    status: text("status").notNull().default("accepted"),
    inputText: text("input_text").notNull(),
    outcome: jsonb("outcome"),
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

export const skeletonCheckEvents = pgTable(
  "skeleton_check_events",
  {
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
    check(
      "skeleton_check_events_seam_check",
      sql`${table.seam} IN ('queued', 'claimed', 'inference', 'vector_write', 'vector_readback', 'completed')`,
    ),
    index("skeleton_check_events_run_id_id_idx").on(table.runId, table.id),
  ],
);
