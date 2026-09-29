import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { loadAiConfig } from "./ai/config.js";
import { createGateway as createAiGateway } from "./ai/gateway.js";
import { logSink } from "./ai/usage.js";
import { createApp } from "./app.js";
import { createValidateSession } from "./auth/session.js";
import { loadConfig } from "./config.js";
import { createDatabaseProbe, createDb } from "./db.js";
import { loadAnswerConfig } from "./library/answer.js";
import { startIngestWorker } from "./library/ingest/worker.js";
import { loadRetrievalConfig } from "./library/retrieve.js";
import { createGateway } from "./ws/gateway.js";

const config = loadConfig();
const aiConfig = loadAiConfig(process.env);
// Validated at boot so a bad RETRIEVAL_* value fails fast (FR-004); unused
// until a route reads it (TASK-0027).
const retrievalConfig = loadRetrievalConfig(process.env);
// Validated at boot beside RETRIEVAL_*, so a bad ASK_MIN_SIMILARITY fails fast too.
const answerConfig = loadAnswerConfig(process.env);

const aiGateway = createAiGateway({
  config: aiConfig,
  sink: logSink,
});
const db = createDb(config.databaseUrl);

// Survives `restart`, not `recreate` (research R8) — acceptable: a job whose
// upload file is gone just fails with "upload file missing".
const uploadDir = path.join(os.tmpdir(), "the-stacks-uploads");
mkdirSync(uploadDir, { recursive: true });

const embedPurposeName = retrievalConfig.embedPurpose;
const embedPurpose =
  aiConfig.purposes[embedPurposeName]?.op === "embed" ? embedPurposeName : null;

const ingestWorker = startIngestWorker({
  db,
  gateway: aiGateway,
  embedPurpose,
  uploadDir,
});

const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
  db,
  commit: config.commit,
  library: {
    uploadMaxBytes: config.uploadMaxBytes,
    uploadDir,
    onEnqueued: ingestWorker.nudge,
    answer: {
      gateway: aiGateway,
      retrieval: retrievalConfig,
      config: answerConfig,
    },
  },
});

// The WebSocket gateway shares this one port and one process with the HTTP
// app (FR-001, architecture A2) — attached to the same underlying server
// `serve()` returns, not a second listener.
const gateway = createGateway({
  db,
  validateSession: createValidateSession(db),
});

// ponytail: a 1-hour request timeout so a large, slow upload isn't cut off
// mid-stream by Node's default (research R1); the ingest worker itself has
// no timeout of its own.
const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    serverOptions: { requestTimeout: 60 * 60 * 1000 },
  },
  (info) => {
    console.log(`Server listening on port ${info.port}`);
  },
);
gateway.attach(server);
