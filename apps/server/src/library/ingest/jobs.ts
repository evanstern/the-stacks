import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ConflictError } from "../../errors.js";
import { jobs } from "../../schema/jobs.js";
import type { DbClient } from "../store.js";

/**
 * The `jobs` claim/lease/fencing store (specs/017-ingestion-pipeline
 * contracts/ingest-modules.md, research R6). Every write after a claim
 * filters on `claim_token`, so a worker whose lease has expired and later
 * wakes up is fenced out rather than corrupting a reclaimed job.
 */

export const LEASE_MS = 60_000;
export const HEARTBEAT_MS = 10_000;
export const POLL_MS = 2_000;
export const MAX_ATTEMPTS = 3;

export type JobFormat = "zip" | "html" | "markdown";
export type JobState = "queued" | "running" | "succeeded" | "failed";
export type JobStage = "extract" | "parse" | "store" | "embed";

export const JobResultSchema = z.object({
  pages: z.number(),
  duplicatePages: z.number(),
  ignoredEntries: z.number(),
  skippedEntries: z.number(),
  parser: z.enum(["ddb", "html", "markdown"]),
  documentId: z.string(),
  chunkCount: z.number(),
  replaced: z.boolean(),
  embedding: z.union([
    z.object({
      status: z.literal("embedded"),
      model: z.string(),
      count: z.number(),
    }),
    z.object({ status: z.literal("skipped"), reason: z.string() }),
  ]),
});
export type JobResult = z.infer<typeof JobResultSchema>;

/** Never exposed as-is: `uploadPath` is stripped by `JobStatusSchema`. */
export interface JobInput {
  format: JobFormat;
  filename: string;
  bytes: number;
  uploadPath: string;
}

export const JobStatusSchema = z.object({
  id: z.string(),
  book: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  stage: z.enum(["extract", "parse", "store", "embed"]).nullable(),
  format: z.enum(["zip", "html", "markdown"]),
  filename: z.string(),
  bytes: z.number(),
  attempts: z.number(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  heartbeatAt: z.string().nullable(),
  result: JobResultSchema.nullable(),
  error: z.string().nullable(),
});
export type JobStatus = z.infer<typeof JobStatusSchema>;

/** A job this process holds the lease on: enough to fence every later write. */
export interface ClaimedJob {
  id: string;
  claimToken: string;
  book: string;
  input: JobInput;
}

const POSTGRES_UNIQUE_VIOLATION = "23505";

// ponytail: copied from library/store.ts's isUniqueViolation rather than a
// shared db.ts helper — TASK-0032 is moving one there; swap at the T031
// reconcile merge (plan.md "Requirements carried from other tasks").
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  const causeCode = (err as { cause?: { code?: unknown } })?.cause?.code;
  return (
    code === POSTGRES_UNIQUE_VIOLATION ||
    causeCode === POSTGRES_UNIQUE_VIOLATION
  );
}

interface JobRow {
  id: string;
  book: string;
  status: string;
  stage: string | null;
  attempts: number;
  input: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  heartbeatAt: Date | null;
}

function toJobStatus(row: JobRow): JobStatus {
  const input = row.input as JobInput;
  return JobStatusSchema.parse({
    id: row.id,
    book: row.book,
    status: row.status,
    stage: row.stage,
    format: input.format,
    filename: input.filename,
    bytes: input.bytes,
    attempts: row.attempts,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    heartbeatAt: row.heartbeatAt?.toISOString() ?? null,
    result: row.result ?? null,
    error: row.error,
  });
}

/** Enqueues a book upload. Refused when another active job already targets the same book (R7, `jobs_active_book_key`). */
export async function enqueueIngest(
  db: DbClient,
  input: {
    book: string;
    format: JobFormat;
    filename: string;
    bytes: number;
    uploadPath: string;
  },
): Promise<JobStatus> {
  try {
    const [row] = await db
      .insert(jobs)
      .values({
        book: input.book,
        input: {
          format: input.format,
          filename: input.filename,
          bytes: input.bytes,
          uploadPath: input.uploadPath,
        },
      })
      .returning();
    return toJobStatus(row as JobRow);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError(
        "A job for this book is already queued or running.",
      );
    }
    throw err;
  }
}

export async function listJobs(
  db: DbClient,
  limit: number,
): Promise<JobStatus[]> {
  const rows = await db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
  return rows.map((row) => toJobStatus(row as JobRow));
}

export async function getJob(
  db: DbClient,
  id: string,
): Promise<JobStatus | null> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  return row ? toJobStatus(row as JobRow) : null;
}

interface ClaimRow extends JobRow {
  claimToken: string;
}

/**
 * Claims the oldest queued job, or a `running` job whose lease has expired
 * (research R6 SQL). A claim that pushes `attempts` past `MAX_ATTEMPTS` is
 * immediately marked `failed` instead of being handed to a caller.
 */
export async function claimJob(db: DbClient): Promise<ClaimedJob | null> {
  const { rows } = await db.execute(sql`
    UPDATE jobs SET
      status = 'running',
      attempts = attempts + 1,
      claim_token = gen_random_uuid(),
      heartbeat_at = now(),
      started_at = coalesce(started_at, now()),
      stage = 'extract'
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued'
         OR (status = 'running' AND heartbeat_at < now() - (interval '1 millisecond' * ${LEASE_MS}))
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      id, book, status, stage, attempts,
      claim_token AS "claimToken",
      heartbeat_at AS "heartbeatAt",
      input, result, error,
      created_at AS "createdAt",
      started_at AS "startedAt",
      finished_at AS "finishedAt"
  `);
  const row = rows[0] as unknown as ClaimRow | undefined;
  if (!row) return null;

  if (row.attempts > MAX_ATTEMPTS) {
    await db
      .update(jobs)
      .set({
        status: "failed",
        stage: null,
        error: "abandoned 3 times (process died mid-job)",
        finishedAt: new Date(),
      })
      .where(and(eq(jobs.id, row.id), eq(jobs.claimToken, row.claimToken)));
    return null;
  }

  return {
    id: row.id,
    claimToken: row.claimToken,
    book: row.book,
    input: row.input as JobInput,
  };
}

function fenced(job: ClaimedJob) {
  return and(eq(jobs.id, job.id), eq(jobs.claimToken, job.claimToken));
}

/** Refreshes the lease clock. Returns false when fenced out (the lease already expired and another worker reclaimed the job). */
export async function heartbeat(
  db: DbClient,
  job: ClaimedJob,
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
  job: ClaimedJob,
  stage: JobStage,
): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ stage })
    .where(fenced(job))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

/** Marks the job terminal (`succeeded` or `failed`). Returns false when fenced out. */
export async function finishJob(
  db: DbClient,
  job: ClaimedJob,
  outcome: { result: JobResult } | { error: string },
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
