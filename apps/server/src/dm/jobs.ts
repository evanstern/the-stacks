import {
  RefIdSchema,
  type SessionProjections,
} from "@the-stacks/session-model";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbClient } from "../auth/session.js";
import { isUniqueViolation } from "../db.js";
import {
  finishJob,
  LEASE_MS,
  MAX_ATTEMPTS,
  saveResult,
} from "../jobs/queue.js";
import type { PresenceReader } from "../presence/index.js";
import { jobs } from "../schema/jobs.js";
import {
  absentHolder,
  isAiSeat,
  isStallCandidate,
  latestStanceSeq,
} from "./floor-state.js";
import type { PlanVerdict } from "./gates/plan-gate.js";
import type { CheckRecord } from "./nodes/check.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { Submission } from "./nodes/resolve.js";
import type { InterpretResult, ReactOutput } from "./nodes/schemas.js";
import type {
  ModelCallRecord,
  NodeErrorKind,
  NodeName,
} from "./pipeline/context.js";
import type { PriorTurn, ResumedPlan } from "./resume.js";

/**
 * DM jobs on the shared `jobs` queue (specs/031-dm-runtime contracts/
 * turn-jobs.md): payload schemas, the priority claim serialized per session,
 * enqueue, the turn checkpoint, and reconcile at worker start. Fenced writes
 * (heartbeat, setStage, finishJob) live in `jobs/queue.ts`.
 */

export const DM_JOB_KINDS = [
  "turn",
  "floor",
  "companion",
  "chronicle",
] as const;
export type DmJobKind = (typeof DM_JOB_KINDS)[number];

export const TurnTriggerSchema = z.enum([
  "commit", // gate appended action.committed
  "approval", // gate appended proposal.approved or proposal.rejected
  "npc-turn", // a turn job ended with a monster active in turn mode
  "scene-start", // POST /dm/sessions/:id/start
  "manual", // POST /dm/sessions/:id/turn
  "reconcile", // worker start found an unanswered commit (FR-008)
  "held", // a turn job ended with an AI companion active whose party action was held (TASK-0244)
  "talk", // an in-character post the world may react to (specs/065)
  "ruling", // a needs_ruling carrier row under the AI seat (spec 102 FR-022)
  "intent", // a direct settled Intent narrated by a coalesced turn (spec 066 FR-031)
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
  // Trigger "talk" only: the earliest claim (spec 066 FR-007). `firstPostAt` is a pre-066 field, still parsed.
  firstPostAt: z.iso.datetime().optional(),
  notBefore: z.iso.datetime().optional(),
});
export type TurnJobInput = z.infer<typeof TurnJobInput>;

export const CompanionJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  companions: z.array(RefIdSchema).min(1).max(4),
  reason: z.enum(["hold", "turn", "prompt", "react"]),
  beatJobId: z.uuid().nullable(), // the held turn job, for reason "hold"
  // Reason "react" only (specs/036-companion-react): database time of the first
  // unanswered human reaction, and the earliest time the worker may claim the job.
  firstReactionAt: z.iso.datetime().optional(),
  notBefore: z.iso.datetime().optional(),
});
export type CompanionJobInput = z.infer<typeof CompanionJobInput>;

export const ChronicleJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  throughSeq: z.number().int().min(0), // chronicle covers rows up to here
});
export type ChronicleJobInput = z.infer<typeof ChronicleJobInput>;

/** Wait before the AI DM passes an absent human's turn, after the 5 s presence grace (ruling Q4). */
export const FLOOR_ABSENCE_WAIT_MS = 30_000;
/** Silence on a party action before the AI DM commits it (ruling Q5). */
export const FLOOR_STALL_WINDOW_MS = 120_000;
/** Reconcile ignores sessions with no event inside this window (an abandoned session). */
export const FLOOR_RECONCILE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * A code-only floor check (specs/049-turn-floor contracts/floor-jobs.md): the AI DM
 * passes an absent human's turn (`absence`) or commits a stalled party action (`stall`).
 */
export const FloorJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  check: z.enum(["absence", "stall"]),
  actionId: RefIdSchema.nullable(), // stall only
  holder: z.string().nullable(), // absence: the absent human's user id
  stanceSeq: z.number().int().min(0).nullable(), // stall: latest stance seq at arm time
  notBefore: z.iso.datetime(), // database time; the earliest claim
});
export type FloorJobInput = z.infer<typeof FloorJobInput>;

export interface FloorJobResult {
  outcome: "passed" | "committed" | "noop" | "skipped" | "refused";
  seqs: number[];
  refusal?: { code: string; message: string };
}

/**
 * The turn checkpoint stored at `jobs.result.checkpoint`. Phase 3 narrows the
 * planning-node outputs; later phases narrow `submissions` and `narration`.
 * The queue only stores and returns the object.
 */
export interface TurnFailure {
  /** "presence" is the pre-pipeline marker write (decision-0024). */
  node: NodeName | "presence";
  kind: NodeErrorKind | "seed";
  message: string;
  detail: Record<string, unknown> | null;
}

/** `jobs.result` of a failed turn job (specs/033 contracts/failure-record.md). */
export interface TurnFailureResult {
  checkpoint: TurnCheckpoint;
  outcome: { status: "failed" };
  check: null;
  calls: ModelCallRecord[];
  failure: TurnFailure;
  /** Seq of the presence marker this turn recorded; null when none. */
  presenceSeq?: number | null;
}

/**
 * The audit loop's job record, kept only to read rows stored before TASK-0272 (spec 103).
 * ponytail: delete with the last pre-0272 job row; nothing writes it.
 */
export interface LegacyAuditIssue {
  kind: string;
  detail: string;
  actor?: string;
  blocking: boolean;
}
export interface LegacyAuditAttempt {
  attempt: number;
  words: number;
  deterministic: { pass: boolean; issues: LegacyAuditIssue[] };
  llm:
    | { verdict: "pass" | "fail"; issues: LegacyAuditIssue[] }
    | { skipped: true }
    | { error: string };
  proseSha256: string;
}
export interface LegacyAuditRecord {
  attempts: LegacyAuditAttempt[];
  final: "passed" | "passed-after-regenerate" | "fallback";
  flagged: boolean;
  shippedProseSha256: string;
}

export interface TurnCheckpoint {
  beat: string[] | null; // frozen action ids, or null before assemble
  /** Plans reused from a paused turn (specs/057); absent or null on rows stored before TASK-0168. */
  resumed?: ResumedPlan[] | null;
  npcTurn: { combatantId: string } | null;
  director: DirectorNodeOutput | null;
  interpret: InterpretResult | null;
  /**
   * Spec 104 FR-018: the `throughSeq` of the projections the last completed narrate read. The
   * next beat's narrate window starts after it. Absent on rows stored before TASK-0269.
   */
  factsThrough?: number;
  /** True once the first-stage cut ran for this turn (specs/064). */
  cut?: boolean;
  /** The talk turn's react output, reused on a reclaim (specs/065 D3). */
  react?: ReactOutput | null;
  submissions: Submission[];
  lastSeq: number; // highest seq the gate returned to this job
  /** The plan gate's verdict per action group; absent on rows stored before TASK-0112. */
  planGate?: PlanVerdict[];
  narration: {
    check?: CheckRecord;
    /** Rows stored before TASK-0272 hold the audit loop's attempts. */
    attempts?: LegacyAuditRecord["attempts"];
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
  | (ClaimBase & { kind: "floor"; input: FloorJobInput })
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
 * (turn, floor, companion, chronicle) and age. A queued turn, floor or companion
 * job is not claimable while another of the three holds a live lease for its
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
        stage = CASE kind WHEN 'turn' THEN 'assemble' WHEN 'companion' THEN 'companion' WHEN 'floor' THEN NULL ELSE 'chronicle' END
      WHERE id = (
        SELECT j.id FROM jobs j
        WHERE j.kind IN ('turn', 'floor', 'companion', 'chronicle')
          AND (
            (j.status = 'running' AND j.heartbeat_at < now() - (interval '1 millisecond' * ${LEASE_MS}))
            OR (j.status = 'queued' AND (
              j.kind = 'chronicle'
              OR (
                NOT EXISTS (
                  SELECT 1 FROM jobs r
                  WHERE r.session_id = j.session_id
                    AND r.kind IN ('turn', 'companion', 'floor')
                    AND r.status = 'running'
                    AND r.heartbeat_at >= now() - (interval '1 millisecond' * ${LEASE_MS})
                )
                AND (
                  j.kind NOT IN ('turn', 'companion', 'floor')
                  OR j.input->>'notBefore' IS NULL
                  OR (j.input->>'notBefore')::timestamptz <= now()
                )
              )
            ))
          )
        ORDER BY (j.status = 'running') DESC,
                 CASE j.kind WHEN 'turn' THEN 1 WHEN 'floor' THEN 2 WHEN 'companion' THEN 3 ELSE 4 END,
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
    case "floor":
      return { ...base, kind: "floor", input: FloorJobInput.parse(row.input) };
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
  // A queued talk turn yields to the new trigger: take its trigger and seq,
  // drop the wait (specs/065 D2).
  if (trigger !== "talk") {
    const converted = await db
      .update(jobs)
      .set({
        input: sql`(${jobs.input} - 'notBefore' - 'firstPostAt') || jsonb_build_object('trigger', ${trigger}::text, 'triggerSeq', ${triggerSeq}::int)`,
      })
      .where(
        and(
          queuedWhere(sessionId, "turn"),
          sql`${jobs.input}->>'trigger' = 'talk'`,
        ),
      )
      .returning({ id: jobs.id });
    if (converted[0]) return { jobId: converted[0].id, inserted: false };
  }
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

/** ISO-8601 UTC text (millisecond precision, `Z`) of a database timestamp expression. */
const isoUtc = (expr: ReturnType<typeof sql>) =>
  sql`to_char(${expr} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/**
 * Queues a `react` companion job, coalesced per session (specs/036-companion-
 * react plan.md "Coalescing design"). `ON CONFLICT DO NOTHING` on
 * `jobs_companion_react_queued_key`: when a queued `react` job exists, merge the
 * companion id into it and move `notBefore` to
 * `least(now() + quietMs, firstReactionAt + maxWaitMs)` in one statement. Both
 * times are database time. Loops when the queued row is claimed in between.
 */
export async function enqueueCompanionReact(
  db: DbClient,
  sessionId: string,
  companionId: string,
  opts: { quietMs: number; maxWaitMs: number },
): Promise<EnqueueResult> {
  const quiet = sql`(interval '1 millisecond' * ${opts.quietMs})`;
  const maxWait = sql`(interval '1 millisecond' * ${opts.maxWaitMs})`;
  for (;;) {
    const ins = await db.execute(sql`
      INSERT INTO jobs (kind, session_id, input)
      VALUES (
        'companion',
        ${sessionId}::uuid,
        jsonb_build_object(
          'v', 1,
          'sessionId', ${sessionId}::text,
          'companions', jsonb_build_array(${companionId}::text),
          'reason', 'react',
          'beatJobId', 'null'::jsonb,
          'firstReactionAt', ${isoUtc(sql`now()`)},
          'notBefore', ${isoUtc(sql`least(now() + ${quiet}, now() + ${maxWait})`)}
        )
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const insertedRow = ins.rows[0] as { id: string } | undefined;
    if (insertedRow) return { jobId: insertedRow.id, inserted: true };
    const upd = await db.execute(sql`
      UPDATE jobs SET input = jsonb_set(
        jsonb_set(
          input,
          '{companions}',
          (
            SELECT jsonb_agg(u.c ORDER BY u.ord)
            FROM (
              SELECT DISTINCT ON (t.c) t.c, t.ord
              FROM jsonb_array_elements_text(
                input->'companions' || jsonb_build_array(${companionId}::text)
              ) WITH ORDINALITY AS t(c, ord)
              ORDER BY t.c, t.ord
            ) u
          )
        ),
        '{notBefore}',
        to_jsonb(${isoUtc(sql`least(now() + ${quiet}, (input->>'firstReactionAt')::timestamptz + ${maxWait})`)})
      )
      WHERE session_id = ${sessionId}::uuid
        AND kind = 'companion'
        AND status = 'queued'
        AND input->>'reason' = 'react'
      RETURNING id
    `);
    const updatedRow = upd.rows[0] as { id: string } | undefined;
    if (updatedRow) return { jobId: updatedRow.id, inserted: false };
    // The queued row was claimed in between; loop to insert a fresh one.
  }
}

/**
 * Queues a `talk` turn (the read), coalesced per session (spec 066 FR-007). `notBefore` is the
 * post's own `ts` plus the window; there is no cap. A queued talk turn takes the new `triggerSeq`
 * and moves its `notBefore`. Any other queued turn absorbs the post: nothing changes and
 * `inserted` is false.
 */
export async function enqueueTalkTurn(
  db: DbClient,
  sessionId: string,
  triggerSeq: number,
  opts: { postTs: string; windowMs: number },
): Promise<EnqueueResult> {
  const notBefore = new Date(
    Date.parse(opts.postTs) + opts.windowMs,
  ).toISOString();
  for (;;) {
    const ins = await db.execute(sql`
      INSERT INTO jobs (kind, session_id, input)
      VALUES (
        'turn',
        ${sessionId}::uuid,
        jsonb_build_object(
          'v', 1,
          'sessionId', ${sessionId}::text,
          'trigger', 'talk',
          'triggerSeq', ${triggerSeq}::int,
          'forceResolve', false,
          'start', 'null'::jsonb,
          'notBefore', ${notBefore}::text
        )
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const insertedRow = ins.rows[0] as { id: string } | undefined;
    if (insertedRow) return { jobId: insertedRow.id, inserted: true };
    const upd = await db.execute(sql`
      UPDATE jobs SET input = input || jsonb_build_object(
        'triggerSeq', ${triggerSeq}::int,
        'notBefore', ${notBefore}::text
      )
      WHERE session_id = ${sessionId}::uuid
        AND kind = 'turn'
        AND status = 'queued'
        AND input->>'trigger' = 'talk'
      RETURNING id
    `);
    const updatedRow = upd.rows[0] as { id: string } | undefined;
    if (updatedRow) return { jobId: updatedRow.id, inserted: false };
    const [other] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(queuedWhere(sessionId, "turn"));
    if (other) return { jobId: other.id, inserted: false };
    // The queued row was claimed in between; loop to insert a fresh one.
  }
}

/**
 * Ends the session's running read, if it has shipped nothing (spec 066 FR-008, plan D3). One
 * update rotates the claim token, so the worker's next fenced write fails and it stops, and
 * finishes the job with outcome `interrupted`. Returns the job id, or null when no read ran or
 * the read had already shipped a row.
 */
export async function interruptRead(
  db: DbClient,
  sessionId: string,
): Promise<string | null> {
  const res = await db.execute(sql`
    UPDATE jobs SET
      status = 'succeeded',
      stage = NULL,
      claim_token = gen_random_uuid(),
      finished_at = now(),
      result = jsonb_build_object(
        'outcome', jsonb_build_object('status', 'interrupted'),
        'talk', jsonb_build_object('outcome', 'interrupted', 'reason', 'a later post arrived during the read'))
    WHERE session_id = ${sessionId}::uuid
      AND kind = 'turn'
      AND status = 'running'
      AND input->>'trigger' = 'talk'
      AND COALESCE(jsonb_array_length(result->'checkpoint'->'submissions'), 0) = 0
      AND COALESCE(result->'checkpoint'->'narration'->>'shipped', 'false') <> 'true'
    RETURNING id
  `);
  return (res.rows[0] as { id: string } | undefined)?.id ?? null;
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

export interface FloorCheckArm {
  sessionId: string;
  check: FloorJobInput["check"];
  actionId: string | null;
  holder: string | null;
  stanceSeq: number | null;
}

/**
 * Arms a floor check (specs/049-turn-floor R9, R10): inserts a queued `floor` job whose
 * `notBefore` is database `now() + waitMs`, or moves `notBefore`, `holder` and `stanceSeq`
 * on the queued row for the same `(session, check, actionId)`. Loops when the queued row
 * is claimed between the insert and the update.
 */
export async function enqueueFloorCheck(
  db: DbClient,
  arm: FloorCheckArm,
  waitMs: number,
): Promise<EnqueueResult> {
  const wait = sql`(interval '1 millisecond' * ${waitMs})`;
  const notBefore = isoUtc(sql`(now() + ${wait})`);
  const actionId = arm.actionId;
  for (;;) {
    const ins = await db.execute(sql`
      INSERT INTO jobs (kind, session_id, input)
      VALUES (
        'floor',
        ${arm.sessionId}::uuid,
        jsonb_build_object(
          'v', 1,
          'sessionId', ${arm.sessionId}::text,
          'check', ${arm.check}::text,
          'actionId', ${actionId}::text,
          'holder', ${arm.holder}::text,
          'stanceSeq', ${arm.stanceSeq}::int,
          'notBefore', ${notBefore}
        )
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const insertedRow = ins.rows[0] as { id: string } | undefined;
    if (insertedRow) return { jobId: insertedRow.id, inserted: true };
    const upd = await db.execute(sql`
      UPDATE jobs SET input = input || jsonb_build_object(
        'holder', ${arm.holder}::text,
        'stanceSeq', ${arm.stanceSeq}::int,
        'notBefore', ${notBefore}
      )
      WHERE session_id = ${arm.sessionId}::uuid
        AND kind = 'floor'
        AND status = 'queued'
        AND input->>'check' = ${arm.check}
        AND coalesce(input->>'actionId', '') = ${actionId ?? ""}
      RETURNING id
    `);
    const updatedRow = upd.rows[0] as { id: string } | undefined;
    if (updatedRow) return { jobId: updatedRow.id, inserted: false };
  }
}

/** Drops the queued floor check for `(session, check, actionId)`, if any. */
export async function cancelFloorCheck(
  db: DbClient,
  sessionId: string,
  check: FloorJobInput["check"],
  actionId: string | null,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM jobs
    WHERE session_id = ${sessionId}::uuid
      AND kind = 'floor'
      AND status = 'queued'
      AND input->>'check' = ${check}
      AND coalesce(input->>'actionId', '') = ${actionId ?? ""}
  `);
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
 * Earlier turn jobs of the session that stored a checkpoint, newest first
 * (specs/057 contracts/turn-resume.md). Excludes the claimed job itself.
 */
export async function loadPriorTurnCheckpoints(
  db: DbClient,
  sessionId: string,
  excludeJobId: string,
): Promise<PriorTurn[]> {
  const rows = await db
    .select({ id: jobs.id, result: jobs.result })
    .from(jobs)
    .where(
      and(
        eq(jobs.kind, "turn"),
        eq(jobs.sessionId, sessionId),
        sql`${jobs.id} <> ${excludeJobId}`,
        sql`${jobs.result}->'checkpoint' IS NOT NULL`,
      ),
    )
    .orderBy(desc(jobs.createdAt), desc(jobs.id));
  return rows.flatMap((r) => {
    const checkpoint = (r.result as { checkpoint?: TurnCheckpoint } | null)
      ?.checkpoint;
    return checkpoint ? [{ jobId: r.id, checkpoint }] : [];
  });
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

export interface FloorReconcileDeps {
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  presence: Pick<PresenceReader, "presentUsers">;
  absenceWaitMs?: number;
  stallWindowMs?: number;
  lookbackMs?: number;
}

/**
 * Floor reconcile (specs/049-turn-floor R10), run at worker start after `reconcileTurnJobs`:
 * arms `absence` for each turn-mode session whose holder is an absent human, and `stall` for
 * each open multi-human party action with no queued `stall`, under an AI seat. Only sessions
 * with an event inside the lookback window are read. Returns the session ids it armed.
 */
export async function reconcileFloorJobs(
  db: DbClient,
  deps: FloorReconcileDeps,
): Promise<string[]> {
  const lookback = sql`(interval '1 millisecond' * ${deps.lookbackMs ?? FLOOR_RECONCILE_LOOKBACK_MS})`;
  const modes = await db.execute(sql`
    SELECT DISTINCT ON (e.session_id) e.session_id AS "sessionId",
      e.payload->'after'->>'mode' AS "mode",
      e.payload->'after'->>'activeActor' AS "holder"
    FROM events e
    WHERE e.type = 'table-mode.changed' AND e.ts > now() - ${lookback}
    ORDER BY e.session_id, e.seq DESC
  `);
  const actions = await db.execute(sql`
    SELECT DISTINCT d.session_id AS "sessionId"
    FROM events d
    WHERE d.type = 'action.declared'
      AND d.payload->>'scope' = 'party'
      AND d.ts > now() - ${lookback}
      AND NOT EXISTS (
        SELECT 1 FROM events c
        WHERE c.session_id = d.session_id
          AND c.type IN ('action.committed', 'action.withdrawn')
          AND c.seq > d.seq
          AND c.payload->>'actionId' = d.payload->>'actionId'
      )
  `);
  const present = (sessionId: string) =>
    deps.presence.presentUsers(sessionId).map((u) => u.userId);
  const candidates = new Set<string>();
  for (const row of modes.rows as unknown as {
    sessionId: string;
    mode: string | null;
    holder: string | null;
  }[]) {
    if (row.mode !== "turn" || !row.holder || row.holder.startsWith("ai:")) {
      continue;
    }
    if (!present(row.sessionId).includes(row.holder)) {
      candidates.add(row.sessionId);
    }
  }
  for (const row of actions.rows as unknown as { sessionId: string }[]) {
    candidates.add(row.sessionId);
  }

  const armed: string[] = [];
  for (const sessionId of candidates) {
    const p = await deps.loadProjections(sessionId);
    if (!isAiSeat(p)) continue;
    const holder = absentHolder(p, present(sessionId));
    if (holder !== null) {
      await enqueueFloorCheck(
        db,
        {
          sessionId,
          check: "absence",
          actionId: null,
          holder,
          stanceSeq: null,
        },
        deps.absenceWaitMs ?? FLOOR_ABSENCE_WAIT_MS,
      );
      armed.push(sessionId);
    }
    for (const action of p.actions) {
      if (!isStallCandidate(p, action)) continue;
      const [queued] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.sessionId, sessionId),
            eq(jobs.status, "queued"),
            sql`${jobs.kind} = 'floor' AND ${jobs.input}->>'check' = 'stall' AND ${jobs.input}->>'actionId' = ${action.actionId}`,
          ),
        );
      if (queued) continue;
      await enqueueFloorCheck(
        db,
        {
          sessionId,
          check: "stall",
          actionId: action.actionId,
          holder: null,
          stanceSeq: latestStanceSeq(action),
        },
        deps.stallWindowMs ?? FLOOR_STALL_WINDOW_MS,
      );
      armed.push(sessionId);
    }
  }
  return armed;
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
  heartbeatAt: Date | null;
  finishedAt: Date | null;
}

function toDmJobRow(r: typeof jobs.$inferSelect): DmJobRow {
  return {
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
    heartbeatAt: r.heartbeatAt,
    finishedAt: r.finishedAt,
  };
}

export async function listDmJobs(
  db: DbClient,
  sessionId: string,
  limit: number | null = 50, // null: every job, no cap
  kind?: DmJobKind,
): Promise<DmJobRow[]> {
  const q = db
    .select()
    .from(jobs)
    .where(
      kind
        ? and(eq(jobs.sessionId, sessionId), eq(jobs.kind, kind))
        : eq(jobs.sessionId, sessionId),
    )
    .orderBy(desc(jobs.createdAt));
  const rows = await (limit === null ? q : q.limit(limit));
  return rows.map(toDmJobRow);
}

export interface DmJobPage {
  rows: DmJobRow[];
  /** True when jobs older than the last row exist. */
  hasMore: boolean;
}

/**
 * One page of the session's DM jobs, newest first, ordered
 * `(created_at desc, id desc)`. `before` is the id of a job of this session:
 * the page holds jobs strictly older than it. Returns null when `before` is
 * not a DM job of this session. Leaves `listDmJobs` unchanged.
 */
export async function listDmJobsPage(
  db: DbClient,
  sessionId: string,
  opts: { limit: number; before?: string },
): Promise<DmJobPage | null> {
  const dmKinds = inArray(jobs.kind, [...DM_JOB_KINDS]);
  const scope = and(eq(jobs.sessionId, sessionId), dmKinds);
  let where = scope;
  if (opts.before !== undefined) {
    const [anchor] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(scope, eq(jobs.id, opts.before)))
      .limit(1);
    if (!anchor) return null;
    where = and(
      scope,
      // Compared in SQL: a JS Date would truncate created_at to milliseconds.
      sql`(${jobs.createdAt}, ${jobs.id}) < (select created_at, id from jobs where id = ${anchor.id})`,
    );
  }
  const rows = await db
    .select()
    .from(jobs)
    .where(where)
    .orderBy(desc(jobs.createdAt), desc(jobs.id))
    .limit(opts.limit + 1);
  const hasMore = rows.length > opts.limit;
  return {
    rows: (hasMore ? rows.slice(0, opts.limit) : rows).map(toDmJobRow),
    hasMore,
  };
}
