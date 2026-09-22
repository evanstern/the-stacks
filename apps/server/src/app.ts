import { Hono } from "hono";
import type { DbClient } from "./auth/session.js";
import { createValidateSession } from "./auth/session.js";
import type { DatabaseProbe } from "./db.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createEchoRoute } from "./routes/echo.js";
import { createHealthRoute } from "./routes/health.js";

export interface CreateAppOptions {
  databaseProbe: DatabaseProbe;
  db: DbClient;
}

/**
 * Builds the configured app WITHOUT binding a port (research D3), so tests
 * can exercise it in-process. The entrypoint (index.ts) is what serves it.
 * The database probe is injected so tests can exercise reachable/unreachable
 * cases without a real Postgres connection (see test/health.test.ts).
 *
 * `validateSession` (contracts/validate-session.md) is built once here from
 * `db` and threaded into both the auth routes' middleware and, for
 * TASK-0015's WebSocket upgrade handler, is available by calling
 * `createValidateSession(db)` again with the same `db` — the function
 * itself takes only a token, never a Hono context.
 */
export function createApp({ databaseProbe, db }: CreateAppOptions) {
  const app = new Hono();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.route("/health", createHealthRoute(databaseProbe));
  app.route("/api/echo", createEchoRoute());
  app.route(
    "/auth",
    createAuthRoutes({ db, validateSession: createValidateSession(db) }),
  );
  return app;
}

export type App = ReturnType<typeof createApp>;
