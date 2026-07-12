/**
 * eval_run handler (spec 010 US4, research R7) — the slow half of the
 * harness on the D12 queue: the API created the eval_runs row (`running`)
 * and enqueued { evalRunId }; this handler executes it via the engine.
 *
 * Division of failure labor: executeEvalRun owns the ROW's honesty (flips
 * it to failed with a scrubbed message), the re-throw lets the queue's
 * retry/backoff machinery see the failure too — but a retried job finds the
 * row no longer `running` and refuses (runs execute exactly once; a retry
 * of a measurement is a NEW measurement). Malformed payloads throw without
 * touching anything: whoever enqueued them is broken, not the run.
 */
import { resolveModelRole } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import { createEmbedClient } from "@stacks/ingestion";
import { executeEvalRun, type QueryEmbedder } from "@stacks/retrieval";

let embedderOverride: QueryEmbedder | null = null;
let cachedEmbedder: QueryEmbedder | null = null;

/** Test seam only — the prod embedder is env-built and cached. */
export function _setEvalEmbedderForTests(embedder: QueryEmbedder | null): void {
  embedderOverride = embedder;
}

function evalEmbedder(): QueryEmbedder {
  if (embedderOverride) return embedderOverride;
  if (!cachedEmbedder) {
    const role = resolveModelRole("embedding");
    const client = createEmbedClient({
      config: role,
      maxBatch: 1,
      timeoutMs: Number.parseInt(process.env.ML_REQUEST_TIMEOUT_MS ?? "15000", 10),
    });
    cachedEmbedder = async (query: string) => {
      const [vector] = await client.embedAll([query]);
      return {
        vector: vector!,
        provider: role.provider,
        model: role.modelId,
        dimensions: role.dimensions,
      };
    };
  }
  return cachedEmbedder;
}

export async function evalRunHandler(db: Database, job: Job): Promise<void> {
  const payload = job.payload as Partial<{ evalRunId: string }>;
  if (!payload.evalRunId) {
    throw new Error(`eval_run job ${job.id} has a malformed payload`);
  }
  await executeEvalRun({ db, embedQuery: evalEmbedder() }, payload.evalRunId);
}
