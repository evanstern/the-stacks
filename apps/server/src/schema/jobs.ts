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
 * advance. DM jobs (specs/031-dm-runtime) share the table (decision-0005).
 */

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("ingest"),
    // Null for DM jobs (turn / companion / chronicle); required for `ingest`.
    book: text("book"),
    // The play session a DM job belongs to; null for `ingest`.
    sessionId: uuid("session_id"),
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
      .where(
        sql`${table.kind} = 'ingest' AND ${table.status} IN ('queued', 'running')`,
      ),
    // One queued beat per session (specs/031-dm-runtime FR-003).
    uniqueIndex("jobs_turn_queued_key")
      .on(table.sessionId)
      .where(sql`${table.kind} = 'turn' AND ${table.status} = 'queued'`),
    // One queued chronicle pass per session (FR-080).
    uniqueIndex("jobs_chronicle_queued_key")
      .on(table.sessionId)
      .where(sql`${table.kind} = 'chronicle' AND ${table.status} = 'queued'`),
    // One acting (turn or companion) job running per session (FR-003).
    uniqueIndex("jobs_session_running_key")
      .on(table.sessionId)
      .where(
        sql`${table.kind} IN ('turn', 'companion') AND ${table.status} = 'running'`,
      ),
    index("jobs_dm_session_idx").on(table.sessionId, table.kind, table.status),
    check(
      "jobs_kind_valid",
      sql`${table.kind} IN ('ingest', 'turn', 'companion', 'chronicle')`,
    ),
    check(
      "jobs_book_required_for_ingest",
      sql`${table.kind} <> 'ingest' OR ${table.book} IS NOT NULL`,
    ),
    check(
      "jobs_session_required_for_dm",
      sql`${table.kind} = 'ingest' OR ${table.sessionId} IS NOT NULL`,
    ),
    check(
      "jobs_status_valid",
      sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed')`,
    ),
    check(
      "jobs_stage_valid",
      sql`${table.stage} IN ('extract', 'parse', 'store', 'embed', 'assemble', 'director', 'interpret', 'adjudicate', 'resolve', 'narrate', 'audit', 'companion', 'chronicle')`,
    ),
  ],
);
