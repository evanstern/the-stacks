/**
 * `ingest_source` job handler — deliberately THIN (the 007 handler doctrine:
 * the registry dispatches, handlers delegate). All pipeline logic lives in
 * @stacks/ingestion's ingestSource(); this file only assembles its
 * dependencies from the environment ONCE and adapts the (db, job) signature.
 *
 * Dependency assembly happens lazily on first job, not at import time, so
 * merely importing the worker in tests doesn't demand a full embedding env
 * (resolveModelRole is fail-fast by design, D14).
 */
import { resolveModelRole } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import {
  createEmbedClient,
  createShippedRegistry,
  ingestSource,
  resolveChunkingParams,
  type IngestDeps,
  type IngestSourcePayload,
} from "@stacks/ingestion";

let cached: Omit<IngestDeps, "db"> | null = null;

function depsFromEnv(): Omit<IngestDeps, "db"> {
  if (!cached) {
    cached = {
      registry: createShippedRegistry(),
      embedClient: createEmbedClient({
        config: resolveModelRole("embedding"),
        maxBatch: Number.parseInt(process.env.EMBED_MAX_BATCH ?? "64", 10),
        timeoutMs: Number.parseInt(process.env.ML_REQUEST_TIMEOUT_MS ?? "15000", 10),
      }),
      chunkingParams: resolveChunkingParams(),
    };
  }
  return cached;
}

export async function ingestSourceHandler(db: Database, job: Job): Promise<void> {
  const payload = job.payload as Partial<IngestSourcePayload>;
  if (!payload.sourceId || typeof payload.targetGeneration !== "number") {
    // Malformed payload is a wiring bug: whoever enqueued it is broken.
    throw new Error(`ingest_source job ${job.id} has a malformed payload`);
  }
  await ingestSource(
    { db, ...depsFromEnv() },
    { sourceId: payload.sourceId, targetGeneration: payload.targetGeneration },
  );
}
