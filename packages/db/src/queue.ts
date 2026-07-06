/**
 * The queue IS Postgres (decision D12): a `jobs` table plus FOR UPDATE SKIP
 * LOCKED, no broker. One transactional store means enqueue can commit
 * atomically with the domain rows it belongs to, and ops is one database.
 *
 * Job lifecycle: queued -> claimed -> succeeded | failed, with two recovery
 * paths — fail() requeues with exponential backoff until max_attempts
 * (research R6), and reclaimStale() rescues claims orphaned by a dead worker.
 * API enqueues; the worker loop drives claimNext/complete/fail.
 * Schema: schema/jobs.ts; lifecycle doc: specs/007-v3-skeleton/data-model.md.
 */
import { sql } from "drizzle-orm";

import type { Database } from "./client";
import { jobs } from "./schema/jobs";

export interface EnqueueInput {
  kind: string;
  payload?: unknown;
  maxAttempts?: number;
}

export type Job = typeof jobs.$inferSelect;

export async function enqueue(db: Database, input: EnqueueInput): Promise<Job> {
  const [row] = await db
    .insert(jobs)
    .values({
      kind: input.kind,
      payload: input.payload ?? {},
      maxAttempts: input.maxAttempts ?? 3,
    })
    .returning();

  if (!row) {
    throw new Error("enqueue: insert returned no row");
  }
  return row;
}

export interface ClaimNextInput {
  workerId: string;
}

/**
 * Claims the oldest runnable job with FOR UPDATE SKIP LOCKED (D12) so concurrent
 * workers never contend on the same row.
 *
 * Shape: SELECT-then-UPDATE inside one transaction, not a single UPDATE.
 * The SELECT ... FOR UPDATE SKIP LOCKED takes the row lock (skipping rows
 * another worker holds), and the UPDATE then flips status while that lock is
 * still held — the transaction is what makes select+update one atomic claim.
 * attempts increments at claim time, not failure time, so a worker that dies
 * mid-job still burns an attempt when the claim is reclaimed.
 */
export async function claimNext(db: Database, input: ClaimNextInput): Promise<Job | undefined> {
  return db.transaction(async (tx) => {
    // Raw SQL so the locking clause — the load-bearing part — stays literal
    // and greppable rather than hidden behind builder options.
    const candidates = await tx.execute<{ id: string }>(
      sql`SELECT id FROM jobs
          WHERE status = 'queued' AND run_at <= now()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
    );

    const candidate = candidates.rows[0];
    if (!candidate) {
      return undefined;
    }

    const [row] = await tx
      .update(jobs)
      .set({
        status: "claimed",
        claimedBy: input.workerId,
        claimedAt: new Date(),
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(sql`${jobs.id} = ${candidate.id}`)
      .returning();

    return row;
  });
}

export async function complete(db: Database, jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "succeeded", updatedAt: new Date() })
    .where(sql`${jobs.id} = ${jobId}`);
}

export interface JobFailure {
  code: string;
  seam?: string;
  message: string;
}

const BACKOFF_BASE_MS = 5_000;

/**
 * Requeues with exponential backoff while attempts remain; fails the job
 * permanently once max_attempts is exhausted (research R6).
 *
 * Backoff is expressed as a future run_at rather than any timer state:
 * claimNext's `run_at <= now()` predicate is the entire delay mechanism, so
 * a waiting retry survives worker restarts for free.
 */
export async function fail(db: Database, jobId: string, error: JobFailure): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(jobs).where(sql`${jobs.id} = ${jobId}`);
    if (!row) {
      return;
    }

    // attempts was already bumped by claimNext, so after the Nth run
    // attempts === N: 1st failure waits base*2^0, 2nd base*2^1, ... The
    // Math.max guards against a hand-inserted row failing at attempts = 0.
    const exhausted = row.attempts >= row.maxAttempts;
    const backoffMs = BACKOFF_BASE_MS * 2 ** Math.max(0, row.attempts - 1);

    // On terminal failure we freeze claimed_by/claimed_at/run_at as forensic
    // evidence of the final attempt; on requeue we clear the claim so the row
    // is claimable again once run_at arrives.
    await tx
      .update(jobs)
      .set({
        status: exhausted ? "failed" : "queued",
        lastError: error,
        runAt: exhausted ? row.runAt : new Date(Date.now() + backoffMs),
        claimedBy: exhausted ? row.claimedBy : null,
        claimedAt: exhausted ? row.claimedAt : null,
        updatedAt: new Date(),
      })
      .where(sql`${jobs.id} = ${jobId}`);
  });
}

export interface ReclaimStaleInput {
  visibilityTimeoutMs: number;
}

/**
 * Requeues claims whose claimed_at predates the visibility timeout — recovers
 * jobs left claimed by a worker that crashed or restarted mid-check.
 *
 * The worker loop calls this periodically. The timeout must exceed the
 * longest honest job runtime, or a live worker gets its job stolen and the
 * check runs twice — tolerable here only because vector writes are
 * idempotent (deterministic id + ON CONFLICT DO NOTHING, FR-012).
 * Reclaiming does not reset attempts, so a crash-looping job still
 * terminates via max_attempts instead of cycling forever.
 */
export async function reclaimStale(db: Database, input: ReclaimStaleInput): Promise<number> {
  // `interval * n` is the standard trick to parameterize an interval:
  // `interval '$1 milliseconds'` would put the placeholder inside a literal.
  const result = await db.execute(
    sql`UPDATE jobs
        SET status = 'queued', claimed_by = NULL, claimed_at = NULL, updated_at = now()
        WHERE status = 'claimed'
          AND claimed_at < now() - interval '1 millisecond' * ${input.visibilityTimeoutMs}`,
  );

  return result.rowCount ?? 0;
}
