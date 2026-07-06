/**
 * Job-kind -> handler dispatch table: the seam that keeps the worker's poll
 * loop (main.ts) generic. The loop claims jobs and consults this registry;
 * it never switches on job.kind itself, so adding a job type is one
 * registerHandler call plus a handler module — no loop changes.
 *
 * Contract for handlers: throw a DomainError (class + seam) on failure; the
 * loop records it into jobs.last_error and the fail() helper decides
 * retry-vs-permanent. A kind with no registered handler is an internal_fault
 * (see main.ts) — an unknown kind in the queue is a deploy/wiring bug.
 */
import type { Database, Job } from "@stacks/db";

export type JobHandler = (db: Database, job: Job) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(kind: string, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export function getHandler(kind: string): JobHandler | undefined {
  return handlers.get(kind);
}
