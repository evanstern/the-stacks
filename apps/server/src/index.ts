import { serve } from "@hono/node-server";
import { loadAiConfig } from "./ai/config.js";
import { createGateway as createAiGateway } from "./ai/gateway.js";
import { logSink } from "./ai/usage.js";
import { createApp } from "./app.js";
import { createValidateSession } from "./auth/session.js";
import { loadConfig } from "./config.js";
import { createDatabaseProbe, createDb } from "./db.js";
import { loadRetrievalConfig } from "./library/retrieve.js";
import { createGateway } from "./ws/gateway.js";

const config = loadConfig();
const aiConfig = loadAiConfig(process.env);
// Validated at boot so a bad RETRIEVAL_* value fails fast (FR-004); unused
// until a route reads it (TASK-0027).
// biome-ignore lint/correctness/noUnusedVariables: reserved for TASK-0027's routes.
const retrievalConfig = loadRetrievalConfig(process.env);

// Constructed once; unused until a route calls it (TASK-0027). Unset AI env
// leaves aiConfig's providers/purposes empty, so this is a no-op today.
// biome-ignore lint/correctness/noUnusedVariables: reserved for TASK-0027's routes.
const aiGateway = createAiGateway({
  config: aiConfig,
  sink: logSink,
});
const db = createDb(config.databaseUrl);
const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
  db,
  commit: config.commit,
});

// The WebSocket gateway shares this one port and one process with the HTTP
// app (FR-001, architecture A2) — attached to the same underlying server
// `serve()` returns, not a second listener.
const gateway = createGateway({
  db,
  validateSession: createValidateSession(db),
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Server listening on port ${info.port}`);
});
gateway.attach(server);
