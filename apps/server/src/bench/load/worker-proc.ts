import type { AiConfig } from "../../ai/config.js";
import { createGateway } from "../../ai/gateway.js";
import type { Provider } from "../../ai/types.js";
import { createDb } from "../../db.js";
import { startIngestWorker } from "../../library/ingest/worker.js";

/**
 * The forked ingest-worker entry (specs/021-load-bench research R4/R6). Run
 * as `node dist/bench/load/worker-proc.js`, configured entirely through the
 * environment and driven by IPC — it has no CLI args of its own:
 *
 * - `LOAD_DATABASE_URL` (required): the load database to run against.
 * - `LOAD_UPLOAD_DIR` (required): this worker's own upload/extraction dir.
 * - `LOAD_HOLD_EMBED=1` (research R6, `restart-mid-ingest`): the `embed()`
 *   call sends IPC `{ type: "embed-held" }` and never resolves, so the
 *   parent can kill this process mid-embed with certainty.
 *
 * Sends `{ type: "ready" }` once the worker loop has started; stops and
 * exits on `{ type: "stop" }`.
 */

const databaseUrl = process.env.LOAD_DATABASE_URL;
const uploadDir = process.env.LOAD_UPLOAD_DIR;
if (!databaseUrl || !uploadDir) {
  throw new Error("worker-proc requires LOAD_DATABASE_URL and LOAD_UPLOAD_DIR");
}

const holdingProvider: Provider = {
  ops: new Set(["embed"]),
  embed(): Promise<{ vectors: number[][]; inputTokens: number }> {
    process.send?.({ type: "embed-held" });
    return new Promise(() => {
      /* never resolves — research R6 */
    });
  },
};

const config: AiConfig = {
  providers: { fake: { kind: "fake", baseUrl: "http://fake/load-bench" } },
  purposes: {
    "load-embed": { provider: "fake", model: "fake-embed-1", op: "embed" },
  },
  prices: {},
};

const db = createDb(databaseUrl);
const gateway = createGateway({
  config,
  sink: { record: () => {} },
  adapters:
    process.env.LOAD_HOLD_EMBED === "1"
      ? { fake: () => holdingProvider }
      : undefined,
});

const worker = startIngestWorker({
  db,
  gateway,
  embedPurpose: "load-embed",
  uploadDir,
});

process.send?.({ type: "ready" });

process.on("message", (msg: unknown) => {
  if ((msg as { type?: string } | null)?.type === "stop") {
    worker
      .stop()
      .then(() => db.$client.end())
      .then(() => process.exit(0));
  }
});
