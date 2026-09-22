import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The append-only session event log (architecture A4, constitution IV).
 *
 * `seq` is assigned by the append path (research D1) — never a sequence or
 * identity column, which is non-transactional and gappy by construction.
 * This file only declares the shape; the append-only guard (data-model.md)
 * is a database trigger hand-added to the generated migration, since it
 * isn't expressible here.
 *
 * No index beyond the primary key: `(session_id, seq)` already serves the
 * only read this feature performs, and a redundant index taxes the hottest
 * write path in the system (data-model.md).
 */
export const events = pgTable(
  "events",
  {
    sessionId: uuid("session_id").notNull(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    actor: text("actor").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    payloadVersion: integer("payload_version").notNull(),
    // "public" is the default visibility marker (FR-013); no event carries
    // an absent visibility.
    visibility: text("visibility").notNull().default("public"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.seq] }),
    check("events_seq_positive", sql`${table.seq} > 0`),
    check("events_payload_version_positive", sql`${table.payloadVersion} > 0`),
  ],
);
