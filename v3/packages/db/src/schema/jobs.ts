import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The `jobs` table — the queue itself (decision D12: Postgres-as-queue, no
 * broker). Rows move queued -> claimed -> succeeded | failed; all lifecycle
 * transitions live in ../queue.ts, this file only shapes the storage.
 * See specs/007-v3-skeleton/data-model.md for the full state machine.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // kind is a free-form dispatch key ("skeleton_check", ...); the worker
    // routes on it, so new job types need no schema change.
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("queued"),
    // attempts increments at claim time (queue.ts claimNext); together with
    // max_attempts it bounds retries (research R6).
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    // run_at doubles as the backoff mechanism: fail() pushes it into the
    // future and claimNext only sees rows where run_at <= now().
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    // Claim bookkeeping: who holds the job and since when. claimed_at drives
    // the visibility-timeout reclaim of jobs orphaned by a dead worker.
    claimedBy: text("claimed_by"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    // Structured JobFailure ({ code, seam?, message }) from the last failure.
    lastError: jsonb("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // text + CHECK instead of a pg enum: same integrity, but adding a state
    // is a one-line migration rather than an ALTER TYPE dance.
    check(
      "jobs_status_check",
      sql`${table.status} IN ('queued', 'claimed', 'succeeded', 'failed')`,
    ),
    // Matches claimNext's hot predicate (status = 'queued' AND run_at <= now())
    // so polling stays an index scan as the table grows.
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
  ],
);
