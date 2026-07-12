/**
 * Worker process entrypoint: the async half of accept-then-async (Principle
 * IV, D12). A single poll loop over the Postgres-backed jobs queue — no HTTP
 * surface, no framework. Job-kind specifics live in handlers/ behind the
 * registry; this file only knows how to claim, dispatch, and record failure.
 *
 * Loop shape per tick: touch heartbeat -> reclaim stale claims (visibility
 * timeout, so a worker that died mid-job doesn't strand it) -> claim one job
 * via SKIP LOCKED (safe under multiple workers) -> dispatch by job.kind.
 * Retry/backoff policy lives in the @stacks/db fail() helper, not here:
 * retryable failures requeue with exponential backoff; exhausted attempts
 * fail permanently (research R6). See specs/007-v3-skeleton/data-model.md
 * (jobs entity) and packages/db/src/queue.ts for the claim/fail mechanics.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import { DomainError } from "@stacks/core";
import { claimNext, createDbClient, fail, reclaimStale } from "@stacks/db";

import { ingestBatchExpandHandler } from "./handlers/ingest-batch-expand";
import { ingestSourceHandler } from "./handlers/ingest-source";
import { skeletonCheckHandler } from "./handlers/skeleton-check";
import { evalRunHandler } from "./handlers/eval-run";
import { getHandler, registerHandler } from "./handlers/registry";

// The one place job kinds are wired to handlers. New job kinds register here;
// the loop below stays untouched (dispatch is data, not control flow).
registerHandler("skeleton_check", skeletonCheckHandler);
registerHandler("ingest_source", ingestSourceHandler);
registerHandler("ingest_batch_expand", ingestBatchExpandHandler);
registerHandler("eval_run", evalRunHandler);

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

  // Graceful shutdown: flip the flag and let the current iteration finish, so
  // an in-flight job completes (or fails through the normal path) rather than
  // being killed mid-write. A hard kill is still safe — reclaimStale recovers
  // the claim after the visibility timeout.
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
      // Visibility timeout: any job claimed longer ago than this is presumed
      // orphaned by a crashed worker and returned to the queue. Reclaim runs
      // every tick so recovery latency is bounded by pollMs, not by luck.
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
            // Preserve the DomainError class/seam into jobs.last_error so the
            // queue row itself explains WHERE the failure happened; anything
            // non-domain is by definition our bug -> internal_fault. fail()
            // decides retry-vs-permanent; this catch only classifies.
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
      // A transient DB outage must not kill the process — log, sleep, retry.
      // dependency_down is a queue-level condition here, not a worker death.
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
