import { and, eq } from "drizzle-orm";
import type { DbClient } from "../library/store.js";
import { jobs } from "../schema/jobs.js";

/**
 * Kind-generic fenced writes on the `jobs` table (specs/031-dm-runtime
 * contracts/turn-jobs.md). Every write after a claim filters on `id` and
 * `claim_token`, so a worker whose lease expired and was reclaimed is fenced
 * out. A `false` return means fenced out. Extracted from
 * `library/ingest/jobs.ts`; the ingest and DM claim queries stay with their
 * kinds.
 */

/** Lease and polling constants shared by every worker of the queue. */
export const LEASE_MS = 60_000;
export const HEARTBEAT_MS = 10_000;
export const POLL_MS = 2_000;
export const MAX_ATTEMPTS = 3;

/** The minimum a fenced write needs: the job id and the claim token. */
export interface FencedJob {
  id: string;
  claimToken: string;
}

function fenced(job: FencedJob) {
  return and(eq(jobs.id, job.id), eq(jobs.claimToken, job.claimToken));
}

/** Refreshes the lease clock. Returns false when fenced out. */
export async function heartbeat(
  db: DbClient,
  job: FencedJob,
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ heartbeatAt: new Date() })
    .where(fenced(job))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

/** Advances the job's stage. Returns false when fenced out. */
export async function setStage(
  db: DbClient,
  job: FencedJob,
  stage: string,
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ stage })
    .where(fenced(job))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

/** Writes `jobs.result` without ending the job (a checkpoint). Returns false when fenced out. */
export async function saveResult(
  db: DbClient,
  job: FencedJob,
  result: unknown,
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ result })
    .where(fenced(job))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

/** Marks the job terminal (`succeeded` or `failed`). Returns false when fenced out. */
export async function finishJob(
  db: DbClient,
  job: FencedJob,
  outcome: { result: unknown } | { error: string },
): Promise<boolean> {
  const succeeded = "result" in outcome;
  const updated = await db
    .update(jobs)
    .set({
      status: succeeded ? "succeeded" : "failed",
      stage: null,
      result: succeeded ? outcome.result : null,
      error: succeeded ? null : outcome.error,
      finishedAt: new Date(),
    })
    .where(fenced(job))
    .returning({ id: jobs.id });
  return updated.length > 0;
}
