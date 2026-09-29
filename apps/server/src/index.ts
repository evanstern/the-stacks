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
import { createGateway } from "./ws/gateway.js";

const config = loadConfig();
const aiConfig = loadAiConfig(process.env);

// Constructed once; unused until a route calls it (TASK-0027). Unset AI env
// leaves aiConfig's providers/purposes empty, so this is a no-op today.
// biome-ignore lint/correctness/noUnusedVariables: reserved for TASK-0027's routes.
const aiGateway = createAiGateway({
  config: aiConfig,
  sink: logSink,
});
const db = createDb(config.databaseUrl);

// Survives `restart`, not `recreate` (research R8) — acceptable: a job whose
// upload file is gone just fails with "upload file missing".
const uploadDir = path.join(os.tmpdir(), "the-stacks-uploads");
mkdirSync(uploadDir, { recursive: true });

const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
  db,
  commit: config.commit,
  library: {
    uploadMaxBytes: config.uploadMaxBytes,
    uploadDir,
    // Replaced with the ingest worker's `nudge` in T021/T022.
    onEnqueued: () => {},
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
