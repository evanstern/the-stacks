import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { createDb } from "../db.js";
import { events } from "../schema/events.js";

/**
 * The event-log seam (contracts/event-log.md), binding for TASK-0015 and
 * TASK-0014.
 */

export type DbClient = ReturnType<typeof createDb>;
export type RecordedEvent = typeof events.$inferSelect;

/**
 * Fixed namespace for this feature's `pg_advisory_xact_lock` keys (research
 * D1, Collision note). The two-argument form takes (namespace, key); a
 * fixed namespace here means this feature's per-session locks can never
 * collide with an unrelated advisory-lock user elsewhere in the process,
 * regardless of what key that other user picks. Arbitrary but fixed —
 * never change this once shipped, or in-flight locks from an old process
 * stop meaning the same thing as new ones.
 */
const EVENT_LOG_LOCK_NAMESPACE = 0x4556_4c47; // ASCII "EVLG"

export interface AppendInput {
  sessionId: string;
  actor: string;
  type: string;
  payload: unknown;
  payloadVersion: number;
  /** Defaults to the public marker when omitted (FR-013). */
  visibility?: string;
}

export interface ReadFromInput {
  sessionId: string;
  /** Cursor: last position already seen. Defaults to the origin (FR-006). */
  afterSeq?: number;
  limit: number;
}

/**
 * Records one event at the end of a session's stream and returns it with
 * the position it received (contracts/event-log.md, "Append").
 *
 * `seq` and `ts` are assigned here, never by the caller: a caller who could
 * supply `seq` could create a gap, and one who could supply `ts` could
 * rewrite the server's ordering authority (data-model.md, Validation
 * rules). The check is a runtime guard, not just a TypeScript one, because
 * a caller (e.g. TASK-0015, deserializing a client message) may hand this
 * function an object built from untrusted JSON.
 *
 * Race-safety (research D1): the whole body runs in one transaction that
 * first takes a transaction-scoped advisory lock keyed on `sessionId`
 * (`pg_advisory_xact_lock`, not the session-scoped `pg_advisory_lock` —
 * the xact form releases automatically at commit or rollback, so a
 * pooled connection can never be handed back to another caller still
 * holding a lock). `seq` is computed from `MAX(seq)` for this session
 * *inside* that locked transaction, so only one writer per session can
 * ever be mid-computation at a time. The `(session_id, seq)` primary key
 * stays as the backstop; this lock is what keeps it from ever firing.
 */
export async function append(
  db: DbClient,
  input: AppendInput,
): Promise<RecordedEvent> {
  if ("seq" in input || "ts" in input) {
    throw new Error(
      "append: seq and ts are assigned by the log and must not be supplied by the caller",
    );
  }

  return db.transaction(async (tx) => {
    // Session ids are UUIDs, not integers; hashtext(...) folds the id into
    // the int4 key pg_advisory_xact_lock's two-argument form requires. A
    // hash collision serializes two unrelated sessions against each
    // other — a performance effect, never a correctness one, since seq is
    // still computed per session below (research D1, Collision note).
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${EVENT_LOG_LOCK_NAMESPACE}, hashtext(${input.sessionId}))`,
    );

    const values: Record<string, unknown> = {
      sessionId: input.sessionId,
      actor: input.actor,
      type: input.type,
      payload: input.payload,
      payloadVersion: input.payloadVersion,
      // seq = COALESCE(MAX(seq), 0) + 1 for this session. Safe against
      // concurrent writers only because the advisory lock above has
      // already serialized every other appender to this same session.
      seq: sql`COALESCE((SELECT MAX(${events.seq}) FROM ${events} WHERE ${events.sessionId} = ${input.sessionId}), 0) + 1`,
    };
    // Omit visibility entirely when not supplied, rather than passing
    // undefined, so the column's DB default ("public") applies (FR-013).
    if (input.visibility !== undefined) {
      values.visibility = input.visibility;
    }

    const [row] = await tx
      .insert(events)
      .values(values as never)
      .returning();
    return row;
  });
}

/**
 * Returns a session's events strictly after a cursor, in ascending order
 * (contracts/event-log.md, "Read from a cursor"). Applies no filtering by
 * visibility, type, or payload version (FR-012) — that's the projection's
 * job (TASK-0015), and it can't filter what the log has already hidden.
 */
export async function readFrom(
  db: DbClient,
  input: ReadFromInput,
): Promise<RecordedEvent[]> {
  const afterSeq = input.afterSeq ?? 0;
  return db
    .select()
    .from(events)
    .where(and(eq(events.sessionId, input.sessionId), gt(events.seq, afterSeq)))
    .orderBy(asc(events.seq))
    .limit(input.limit);
}
