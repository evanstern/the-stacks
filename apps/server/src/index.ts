import { mkdirSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
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
import { createDmEnqueuer } from "./dm/enqueue.js";
import { missingDmPurposes } from "./dm/purposes.js";
import { startDmWorker } from "./dm/worker.js";
import { createGate } from "./gate/index.js";
import { loadAnswerConfig } from "./library/answer.js";
import { startIngestWorker } from "./library/ingest/worker.js";
import { loadRetrievalConfig, retrieve } from "./library/retrieve.js";
import { createPresence } from "./presence/index.js";
import { loadProjections } from "./session/projections.js";
import { isReservedPath } from "./static.js";
// `import type` only: web-dev.js itself is loaded dynamically, below, behind
// STACKS_WEB_DEV, so production never pulls in `vite` (plan D7).
import type { WebDev } from "./web-dev.js";
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

// The gate and the DM runtime come before the app: the /dm routes nudge the
// worker, and the worker submits through the gate (specs/031-dm-runtime).
// Presence comes first: the gate reads it (TASK-0051 Phase 3) and the gateway feeds it.
const presence = createPresence();
const gate = createGate({ db, presence: presence.reader });
const loadDmProjections = (sessionId: string) =>
  loadProjections(db, sessionId, { role: "dm" });
const loadDmProjectionsThrough = (sessionId: string, throughSeq: number) =>
  loadProjections(db, sessionId, { role: "dm" }, { throughSeq });
const missingPurposes = missingDmPurposes(aiConfig.purposes);
if (missingPurposes.length > 0) {
  console.warn(
    `DM runtime: unconfigured purposes (turns that call them will fail): ${missingPurposes.join(", ")}`,
  );
}
const dmWorker = startDmWorker({
  db,
  gateway: aiGateway,
  gate,
  retrieve: (q) =>
    retrieve({ db, gateway: aiGateway, config: retrievalConfig }, q),
  loadProjections: loadDmProjections,
  loadProjectionsThrough: loadDmProjectionsThrough,
  minSimilarity: answerConfig.minSimilarity,
});
const dmEnqueuer = createDmEnqueuer({
  db,
  nudge: dmWorker.nudge,
  loadProjections: loadDmProjections,
  log: (line) => console.error(JSON.stringify(line)),
});

// Vite in middleware mode (plan D7, research R8) — a dynamic import behind
// the flag, so production never pulls in `vite`.
const webDev: WebDev | undefined =
  process.env.STACKS_WEB_DEV === "1"
    ? await (await import("./web-dev.js")).createWebDev()
    : undefined;

const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
  db,
  commit: config.commit,
  dm: { nudge: dmWorker.nudge },
  web: webDev && { handler: webDev.handler },
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
  gate,
  presence,
});
// Every row the gate appends reaches the entitled subscribers (ws-delivery.md).
gate.onAppended(gateway.publish);
// Every committed action (and AI DM proposal decision) queues a DM turn.
gate.onAppended(dmEnqueuer.onAppended);

// ponytail: a 1-hour request timeout so a large, slow upload isn't cut off
// mid-stream by Node's default (research R1); the ingest worker itself has
// no timeout of its own.
// Dev mode only: a reserved request goes straight to Hono; everything else
// runs through Vite's middlewares first, which fall through to Hono via
// `next()` for anything Vite doesn't serve (plan D7). Cast to `typeof
// createServer` because node:http's own overloads don't otherwise line up
// with Hono's `createServer` option — the runtime shape is what matters.
const createDevServer = (
  serverOptions: Parameters<typeof createHttpServer>[0],
  listener: Parameters<typeof createHttpServer>[1],
) =>
  createHttpServer(serverOptions ?? {}, (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (isReservedPath(path)) return listener?.(req, res);
    webDev?.middlewares(req, res, () => listener?.(req, res));
  });

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    serverOptions: { requestTimeout: 60 * 60 * 1000 },
    createServer: webDev
      ? (createDevServer as typeof createHttpServer)
      : undefined,
  },
  (info) => {
    console.log(`Server listening on port ${info.port}`);
  },
);
gateway.attach(server);
