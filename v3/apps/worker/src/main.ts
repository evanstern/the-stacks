import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { DomainError } from "@stacks/core";
import { claimNext, createDbClient, fail, reclaimStale } from "@stacks/db";

import { skeletonCheckHandler } from "./handlers/skeleton-check";
import { getHandler, registerHandler } from "./handlers/registry";

registerHandler("skeleton_check", skeletonCheckHandler);

const HEARTBEAT_PATH = process.env.WORKER_HEARTBEAT_PATH ?? "/tmp/worker-heartbeat";

function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields, time: new Date().toISOString() }));
}

// The worker has no HTTP surface, so the compose healthcheck ("process check",
// plan.md) verifies liveness by checking this file's mtime is fresh.
function touchHeartbeat(): void {
  try {
    writeFileSync(HEARTBEAT_PATH, String(Date.now()));
  } catch {
    // best-effort; a missing/unwritable heartbeat path just fails the healthcheck
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const workerId = `worker-${randomUUID()}`;
  const pollMs = Number.parseInt(process.env.WORKER_POLL_MS ?? "2000", 10);
  const visibilityTimeoutMs = Number.parseInt(
    process.env.WORKER_VISIBILITY_TIMEOUT_MS ?? "60000",
    10,
  );

  const { db, pool } = createDbClient(process.env.DATABASE_URL!);

  let running = true;
  const shutdown = () => {
    log("shutdown_requested");
    running = false;
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  log("worker_started", { workerId, pollMs, visibilityTimeoutMs });

  while (running) {
    touchHeartbeat();
    try {
      const reclaimed = await reclaimStale(db, { visibilityTimeoutMs });
      if (reclaimed > 0) {
        log("jobs_reclaimed", { count: reclaimed });
      }

      const job = await claimNext(db, { workerId });
      if (job) {
        log("job_claimed", { jobId: job.id, kind: job.kind });
        const handler = getHandler(job.kind);

        if (!handler) {
          await fail(db, job.id, {
            code: "internal_fault",
            message: `No handler registered for job kind: ${job.kind}`,
          });
          log("job_failed_no_handler", { jobId: job.id, kind: job.kind });
        } else {
          try {
            await handler(db, job);
            log("job_handled", { jobId: job.id, kind: job.kind });
          } catch (error) {
            const domainError = error instanceof DomainError ? error : undefined;
            await fail(db, job.id, {
              code: domainError?.class ?? "internal_fault",
              seam: domainError?.seam,
              message: error instanceof Error ? error.message : "Unknown handler error",
            });
            log("job_handler_error", {
              jobId: job.id,
              kind: job.kind,
              class: domainError?.class ?? "internal_fault",
            });
          }
        }
        continue; // check for more work immediately rather than waiting a full poll interval
      }
    } catch (error) {
      log("poll_error", { message: error instanceof Error ? error.message : String(error) });
    }

    await sleep(pollMs);
  }

  await pool.end();
  log("worker_stopped", { workerId });
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
