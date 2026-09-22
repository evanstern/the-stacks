import { Hono } from "hono";
import type { DatabaseProbe } from "./db.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { createHealthRoute } from "./routes/health.js";

export interface CreateAppOptions {
  databaseProbe: DatabaseProbe;
}

/**
 * Builds the configured app WITHOUT binding a port (research D3), so tests
 * can exercise it in-process. The entrypoint (index.ts) is what serves it.
 * The database probe is injected so tests can exercise reachable/unreachable
 * cases without a real Postgres connection (see test/health.test.ts).
 */
export function createApp({ databaseProbe }: CreateAppOptions) {
  const app = new Hono();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.route("/health", createHealthRoute(databaseProbe));
  return app;
}

export type App = ReturnType<typeof createApp>;
