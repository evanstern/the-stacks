import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * `jobs` (specs/017-ingestion-pipeline data-model.md): operational state of
 * the library plane, one row per upload. Unlike `library_*` (schema/
 * library.ts), this table is NOT under the `library_immutable` trigger —
 * rows are updated in place as a job's stage, attempts, and claim token
 * advance. Only one table for now (decision-0005); `kind`'s CHECK is the
 * seam a later job kind extends.
 */

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("ingest"),
    book: text("book").notNull(),
    status: text("status").notNull().default("queued"),
    // Non-null only while `running`; null when queued or terminal.
    stage: text("stage"),
    attempts: integer("attempts").notNull().default(0),
    // New per claim (research R6); fences every post-claim write so a
    // worker that wakes after its lease expired can't touch a job another
    // worker has since reclaimed.
    claimToken: uuid("claim_token"),
    // Lease clock: a `running` job whose heartbeat is older than LEASE_MS
    // is reclaimable.
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    // { format, filename, bytes, uploadPath } — never exposed by
    // JobStatusSchema (contracts/http-ingest.md).
    input: jsonb("input").notNull(),
    // JobResult (data-model.md); set on `succeeded`.
    result: jsonb("result"),
    // Failure reason; set on `failed`. Never contains book text.
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    // Serves the claim query: oldest queued job first (research R6).
    index("jobs_claim_idx").on(table.status, table.createdAt),
    // At most one active (queued or running) job per book (R7) — a second
    // upload of a book already in flight is a 409, not a race.
    uniqueIndex("jobs_active_book_key")
      .on(sql`lower(trim(${table.book}))`)
      .where(sql`${table.status} IN ('queued', 'running')`),
    check("jobs_kind_valid", sql`${table.kind} IN ('ingest')`),
    check(
      "jobs_status_valid",
      sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed')`,
    ),
    check(
      "jobs_stage_valid",
      sql`${table.stage} IN ('extract', 'parse', 'store', 'embed')`,
    ),
  ],
);
