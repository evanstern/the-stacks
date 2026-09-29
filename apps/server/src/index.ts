import { serve } from "@hono/node-server";
import { createGateway as createAiGateway } from "./ai/gateway.js";
import { logSink } from "./ai/usage.js";
import { createApp } from "./app.js";
import { createValidateSession } from "./auth/session.js";
import { loadConfig } from "./config.js";
import { createDatabaseProbe, createDb } from "./db.js";
import { createGateway } from "./ws/gateway.js";

const config = loadConfig();

// Constructed once; unused until a route calls it (TASK-0027). Unset AI env
// leaves config.ai's providers/purposes empty, so this is a no-op today.
// biome-ignore lint/correctness/noUnusedVariables: reserved for TASK-0027's routes.
const aiGateway = createAiGateway({
  config: config.ai ?? { providers: {}, purposes: {}, prices: {} },
  sink: logSink,
});
const db = createDb(config.databaseUrl);
const app = createApp({
  databaseProbe: createDatabaseProbe(config.databaseUrl),
  db,
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
