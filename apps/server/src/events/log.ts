import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { createDb } from "../db.js";
import { events } from "../schema/events.js";

/**
 * The event-log seam (contracts/event-log.md), binding for TASK-0015 and
 * TASK-0014. This phase (US1) implements append + readFrom without the
 * concurrency lock — T021 (Phase 4) adds `pg_advisory_xact_lock`; a plain
 * `MAX(seq)+1` is correct and expected here (tasks.md T016 note).
 */

export type DbClient = ReturnType<typeof createDb>;
export type RecordedEvent = typeof events.$inferSelect;

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

  const values: Record<string, unknown> = {
    sessionId: input.sessionId,
    actor: input.actor,
    type: input.type,
    payload: input.payload,
    payloadVersion: input.payloadVersion,
    // seq = COALESCE(MAX(seq), 0) + 1 for this session, computed in the
    // same INSERT so there's no separate read step to race against
    // (research D1; the advisory lock that makes this race-safe under
    // concurrency is T021, Phase 4 — out of scope here).
    seq: sql`COALESCE((SELECT MAX(${events.seq}) FROM ${events} WHERE ${events.sessionId} = ${input.sessionId}), 0) + 1`,
  };
  // Omit visibility entirely when not supplied, rather than passing
  // undefined, so the column's DB default ("public") applies (FR-013).
  if (input.visibility !== undefined) {
    values.visibility = input.visibility;
  }

  const [row] = await db
    .insert(events)
    .values(values as never)
    .returning();
  return row;
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
