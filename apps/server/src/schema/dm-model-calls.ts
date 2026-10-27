import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs.js";

/**
 * `dm_model_calls` (specs/037-debug-api data-model.md): one row per DM model
 * attempt, written as the attempt ends. Operational state beside `jobs`, not
 * the session plane: it is not an event and no projection reads it. It holds
 * no prompt or completion text. Code only inserts; nothing updates a row.
 */
export const dmModelCalls = pgTable(
  "dm_model_calls",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull(),
    jobKind: text("job_kind").notNull(),
    // `jobs.attempts` at the claim that made the call.
    jobAttempt: integer("job_attempt").notNull(),
    purpose: text("purpose").notNull(),
    promptVersion: text("prompt_version").notNull(),
    callAttempt: integer("call_attempt").notNull(),
    outcome: text("outcome").notNull(),
    errorKind: text("error_kind"),
    provider: text("provider"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // Null when unpriced or unrecorded; never 0 for unpriced.
    costUsd: doublePrecision("cost_usd"),
    durationMs: integer("duration_ms"),
    httpAttempts: integer("http_attempts"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dm_model_calls_session_idx").on(table.sessionId, table.id),
    index("dm_model_calls_job_idx").on(table.jobId),
    check(
      "dm_model_calls_job_kind_valid",
      sql`${table.jobKind} IN ('turn', 'companion', 'chronicle')`,
    ),
    check(
      "dm_model_calls_call_attempt_valid",
      sql`${table.callAttempt} IN (1, 2)`,
    ),
    check(
      "dm_model_calls_outcome_valid",
      sql`${table.outcome} IN ('ok', 'invalid-json', 'error', 'aborted')`,
    ),
  ],
);

export type DmModelCallRow = typeof dmModelCalls.$inferSelect;
export type NewDmModelCall = typeof dmModelCalls.$inferInsert;
