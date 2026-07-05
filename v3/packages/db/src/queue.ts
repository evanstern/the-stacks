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
 */
export async function claimNext(db: Database, input: ClaimNextInput): Promise<Job | undefined> {
  return db.transaction(async (tx) => {
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
 */
export async function fail(db: Database, jobId: string, error: JobFailure): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(jobs).where(sql`${jobs.id} = ${jobId}`);
    if (!row) {
      return;
    }

    const exhausted = row.attempts >= row.maxAttempts;
    const backoffMs = BACKOFF_BASE_MS * 2 ** Math.max(0, row.attempts - 1);

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
 */
export async function reclaimStale(db: Database, input: ReclaimStaleInput): Promise<number> {
  const result = await db.execute(
    sql`UPDATE jobs
        SET status = 'queued', claimed_by = NULL, claimed_at = NULL, updated_at = now()
        WHERE status = 'claimed'
          AND claimed_at < now() - interval '1 millisecond' * ${input.visibilityTimeoutMs}`,
  );

  return result.rowCount ?? 0;
}
