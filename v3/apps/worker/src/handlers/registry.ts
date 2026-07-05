import type { Database, Job } from "@stacks/db";

export type JobHandler = (db: Database, job: Job) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(kind: string, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export function getHandler(kind: string): JobHandler | undefined {
  return handlers.get(kind);
}
