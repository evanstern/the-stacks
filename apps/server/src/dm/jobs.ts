import { RefIdSchema } from "@the-stacks/session-model";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbClient } from "../auth/session.js";
import { isUniqueViolation } from "../db.js";
import {
  finishJob,
  LEASE_MS,
  MAX_ATTEMPTS,
  saveResult,
} from "../jobs/queue.js";
import { jobs } from "../schema/jobs.js";
import type { AdjudicateOutput } from "./nodes/adjudicate.js";
import type { AuditRecord } from "./nodes/audit.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { Submission } from "./nodes/resolve.js";
import type { InterpretOutput } from "./nodes/schemas.js";
import type {
  ModelCallRecord,
  NodeErrorKind,
  NodeName,
} from "./pipeline/context.js";

/**
 * DM jobs on the shared `jobs` queue (specs/031-dm-runtime contracts/
 * turn-jobs.md): payload schemas, the priority claim serialized per session,
 * enqueue, the turn checkpoint, and reconcile at worker start. Fenced writes
 * (heartbeat, setStage, finishJob) live in `jobs/queue.ts`.
 */

export const DM_JOB_KINDS = ["turn", "companion", "chronicle"] as const;
export type DmJobKind = (typeof DM_JOB_KINDS)[number];

export const TurnTriggerSchema = z.enum([
  "commit", // gate appended action.committed
  "approval", // gate appended proposal.approved or proposal.rejected
  "npc-turn", // a turn job ended with a monster active in turn mode
  "scene-start", // POST /dm/sessions/:id/start
  "manual", // POST /dm/sessions/:id/turn
  "reconcile", // worker start found an unanswered commit (FR-008)
]);
export type TurnTrigger = z.infer<typeof TurnTriggerSchema>;

export const TurnJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  trigger: TurnTriggerSchema,
  triggerSeq: z.number().int().min(1).nullable(), // the row that caused the enqueue
  forceResolve: z.boolean().default(false), // set by a companion job ending a hold
  start: z
    .object({
      // scene-start only
      seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
      seats: z.record(RefIdSchema, z.uuid()), // human characterId -> userId
    })
    .nullable()
    .default(null),
});
export type TurnJobInput = z.infer<typeof TurnJobInput>;

export const CompanionJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  companions: z.array(RefIdSchema).min(1).max(4),
  reason: z.enum(["hold", "turn", "prompt"]),
  beatJobId: z.uuid().nullable(), // the held turn job, for reason "hold"
});
export type CompanionJobInput = z.infer<typeof CompanionJobInput>;

export const ChronicleJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  throughSeq: z.number().int().min(0), // chronicle covers rows up to here
});
export type ChronicleJobInput = z.infer<typeof ChronicleJobInput>;

/**
 * The turn checkpoint stored at `jobs.result.checkpoint`. Phase 3 narrows the
 * planning-node outputs; later phases narrow `submissions` and `narration`.
 * The queue only stores and returns the object.
 */
export interface TurnFailure {
  node: NodeName;
  kind: NodeErrorKind | "seed";
  message: string;
  detail: Record<string, unknown> | null;
}

/** `jobs.result` of a failed turn job (specs/033 contracts/failure-record.md). */
export interface TurnFailureResult {
  checkpoint: TurnCheckpoint;
  outcome: { status: "failed" };
  audit: null;
  calls: ModelCallRecord[];
  failure: TurnFailure;
}

export interface TurnCheckpoint {
  beat: string[] | null; // frozen action ids, or null before assemble
  npcTurn: { combatantId: string } | null;
  director: DirectorNodeOutput | null;
  interpret: InterpretOutput | null;
  adjudicate: AdjudicateOutput | null;
  submissions: Submission[];
  lastSeq: number; // highest seq the gate returned to this job
  narration: {
    attempts: AuditRecord["attempts"];
    shipped: boolean;
    /** The shipped narration's event seqs, ascending; absent on rows stored before TASK-0116. */
    seqs: number[];
  } | null;
}

interface ClaimBase {
  id: string;
  claimToken: string;
  sessionId: string;
  attempts: number;
  /** The previous attempt's `jobs.result` (a reclaimed turn job's checkpoint lives here). */
  result: unknown;
}

export type ClaimedDmJob =
  | (ClaimBase & { kind: "turn"; input: TurnJobInput })
  | (ClaimBase & { kind: "companion"; input: CompanionJobInput })
  | (ClaimBase & { kind: "chronicle"; input: ChronicleJobInput });

interface ClaimRow {
  id: string;
  kind: DmJobKind;
  attempts: number;
  claimToken: string;
  sessionId: string;
  input: unknown;
  result: unknown;
}

/**
 * Claims the next DM job: an expired lease first, then queued by priority
 * (turn, companion, chronicle) and age. A queued turn or companion job is not
 * claimable while another turn or companion job holds a live lease for its
 * session. A unique violation on `jobs_session_running_key` (a reclaim racing
 * a queued claim) returns null. A claim past `MAX_ATTEMPTS` is failed and
 * returns null.
 */
export async function claimDmJob(
  db: DbClient,
  opts: {
    /** Called after a job past MAX_ATTEMPTS is failed (FR-012: append the failure notice). */
    onAbandoned?: (job: {
      id: string;
      kind: DmJobKind;
      sessionId: string;
    }) => Promise<void> | void;
  } = {},
): Promise<ClaimedDmJob | null> {
  let rows: unknown[];
  try {
    ({ rows } = await db.execute(sql`
      UPDATE jobs SET
        status = 'running',
        attempts = attempts + 1,
        claim_token = gen_random_uuid(),
        heartbeat_at = now(),
        started_at = coalesce(started_at, now()),
        stage = CASE kind WHEN 'turn' THEN 'assemble' WHEN 'companion' THEN 'companion' ELSE 'chronicle' END
      WHERE id = (
        SELECT j.id FROM jobs j
        WHERE j.kind IN ('turn', 'companion', 'chronicle')
          AND (
            (j.status = 'running' AND j.heartbeat_at < now() - (interval '1 millisecond' * ${LEASE_MS}))
            OR (j.status = 'queued' AND (
              j.kind = 'chronicle'
              OR NOT EXISTS (
                SELECT 1 FROM jobs r
                WHERE r.session_id = j.session_id
                  AND r.kind IN ('turn', 'companion')
                  AND r.status = 'running'
                  AND r.heartbeat_at >= now() - (interval '1 millisecond' * ${LEASE_MS})
              )
            ))
          )
        ORDER BY (j.status = 'running') DESC,
                 CASE j.kind WHEN 'turn' THEN 1 WHEN 'companion' THEN 2 ELSE 3 END,
                 j.created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, kind, attempts,
        claim_token AS "claimToken",
        session_id AS "sessionId",
        input, result
    `));
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
  const row = rows[0] as ClaimRow | undefined;
  if (!row) return null;

  if (row.attempts > MAX_ATTEMPTS) {
    await finishJob(db, row, {
      error: `abandoned ${MAX_ATTEMPTS} times (process died mid-job)`,
    });
    await opts.onAbandoned?.({
      id: row.id,
      kind: row.kind,
      sessionId: row.sessionId,
    });
    return null;
  }

  const base: ClaimBase = {
    id: row.id,
    claimToken: row.claimToken,
    sessionId: row.sessionId,
    attempts: row.attempts,
    result: row.result ?? null,
  };
  switch (row.kind) {
    case "turn":
      return { ...base, kind: "turn", input: TurnJobInput.parse(row.input) };
    case "companion":
      return {
        ...base,
        kind: "companion",
        input: CompanionJobInput.parse(row.input),
      };
    default:
      return {
        ...base,
        kind: "chronicle",
        input: ChronicleJobInput.parse(row.input),
      };
  }
}

export interface EnqueueResult {
  jobId: string;
  /** False when a queued job already covered the request. */
  inserted: boolean;
}

/**
 * Enqueues the session's next beat. `ON CONFLICT DO NOTHING` on
 * `jobs_turn_queued_key`: a queued job already covers the next beat, so a
 * second enqueue is a no-op and returns the existing job.
 */
export async function enqueueTurn(
  db: DbClient,
  sessionId: string,
  trigger: TurnTrigger,
  triggerSeq: number | null = null,
  opts: { start?: TurnJobInput["start"]; forceResolve?: boolean } = {},
): Promise<EnqueueResult> {
  const input: TurnJobInput = TurnJobInput.parse({
    v: 1,
    sessionId,
    trigger,
    triggerSeq,
    forceResolve: opts.forceResolve ?? false,
    start: opts.start ?? null,
  });
  const inserted = await db
    .insert(jobs)
    .values({ kind: "turn", sessionId, input })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  if (inserted[0]) return { jobId: inserted[0].id, inserted: true };
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(queuedWhere(sessionId, "turn"));
  if (!existing) {
    // The covering job was claimed between the insert and the read; the
    // caller's request belongs to the next beat, so insert again.
    return enqueueTurn(db, sessionId, trigger, triggerSeq, opts);
  }
  return { jobId: existing.id, inserted: false };
}

/**
 * The companion job's upsert (a hold ends): insert a queued turn job with
 * `forceResolve: true`, or flip the flag on the queued row.
 */
export async function enqueueTurnForced(
  db: DbClient,
  sessionId: string,
): Promise<EnqueueResult> {
  for (;;) {
    const inserted = await enqueueTurn(db, sessionId, "manual", null, {
      forceResolve: true,
    });
    if (inserted.inserted) return inserted;
    const updated = await db
      .update(jobs)
      .set({
        input: sql`jsonb_set(${jobs.input}, '{forceResolve}', 'true'::jsonb)`,
      })
      .where(queuedWhere(sessionId, "turn"))
      .returning({ id: jobs.id });
    if (updated[0]) return { jobId: updated[0].id, inserted: false };
    // The queued row was claimed in between; loop to insert a fresh one.
  }
}

function queuedWhere(sessionId: string, kind: DmJobKind) {
  return and(
    eq(jobs.sessionId, sessionId),
    eq(jobs.kind, kind),
    eq(jobs.status, "queued"),
  );
}

export async function enqueueCompanion(
  db: DbClient,
  input: Omit<CompanionJobInput, "v">,
): Promise<EnqueueResult> {
  const parsed = CompanionJobInput.parse({ v: 1, ...input });
  const [row] = await db
    .insert(jobs)
    .values({ kind: "companion", sessionId: parsed.sessionId, input: parsed })
    .returning({ id: jobs.id });
  return { jobId: (row as { id: string }).id, inserted: true };
}

/** `ON CONFLICT DO NOTHING` on `jobs_chronicle_queued_key`: one queued pass per session. */
export async function enqueueChronicle(
  db: DbClient,
  sessionId: string,
  throughSeq: number,
): Promise<EnqueueResult | null> {
  const parsed = ChronicleJobInput.parse({ v: 1, sessionId, throughSeq });
  const inserted = await db
    .insert(jobs)
    .values({ kind: "chronicle", sessionId, input: parsed })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  return inserted[0] ? { jobId: inserted[0].id, inserted: true } : null;
}

/** Writes `result.checkpoint` (fenced). Returns false when fenced out. */
export function saveCheckpoint(
  db: DbClient,
  job: { id: string; claimToken: string },
  checkpoint: TurnCheckpoint,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  return saveResult(db, job, { ...extra, checkpoint });
}

/** Reads the checkpoint a claimed job's previous attempt left, or null. */
export function loadCheckpoint(job: {
  result: unknown;
}): TurnCheckpoint | null {
  const result = job.result as { checkpoint?: TurnCheckpoint } | null;
  return result?.checkpoint ?? null;
}

/**
 * FR-008: at worker start, enqueue one `reconcile` turn job for every session
 * with an `action.committed` row that has no later `action.resolved` row for
 * the same action id and no queued or running turn job.
 */
export async function reconcileTurnJobs(db: DbClient): Promise<string[]> {
  const { rows } = await db.execute(sql`
    SELECT c.session_id AS "sessionId", max(c.seq) AS "seq"
    FROM events c
    WHERE c.type = 'action.committed'
      AND NOT EXISTS (
        SELECT 1 FROM events r
        WHERE r.session_id = c.session_id
          AND r.type = 'action.resolved'
          AND r.seq > c.seq
          AND r.payload->>'actionId' = c.payload->>'actionId'
      )
      AND NOT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.session_id = c.session_id
          AND j.kind = 'turn'
          AND j.status IN ('queued', 'running')
      )
    GROUP BY c.session_id
  `);
  const enqueued: string[] = [];
  for (const row of rows as unknown as { sessionId: string; seq: number }[]) {
    const result = await enqueueTurn(
      db,
      row.sessionId,
      "reconcile",
      Number(row.seq),
    );
    if (result.inserted) enqueued.push(row.sessionId);
  }
  return enqueued;
}

export interface DmJobRow {
  id: string;
  kind: DmJobKind;
  status: string;
  stage: string | null;
  attempts: number;
  input: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export async function listDmJobs(
  db: DbClient,
  sessionId: string,
  limit = 50,
  kind?: DmJobKind,
): Promise<DmJobRow[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(
      kind
        ? and(eq(jobs.sessionId, sessionId), eq(jobs.kind, kind))
        : eq(jobs.sessionId, sessionId),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as DmJobKind,
    status: r.status,
    stage: r.stage,
    attempts: r.attempts,
    input: r.input,
    result: r.result,
    error: r.error,
    createdAt: r.createdAt,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
  }));
}
