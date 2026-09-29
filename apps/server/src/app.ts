import os from "node:os";
import { Hono } from "hono";
import type { DbClient } from "./auth/session.js";
import { createValidateSession } from "./auth/session.js";
import type { DatabaseProbe } from "./db.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createEchoRoute } from "./routes/echo.js";
import { createHealthRoute } from "./routes/health.js";
import { createLibraryRoutes } from "./routes/library.js";
import { createStaticMiddleware } from "./static.js";

/** Ceiling on a single upload's file-part size (config.ts UPLOAD_MAX_BYTES). Test-safe default: 1 GiB. */
const DEFAULT_UPLOAD_MAX_BYTES = 1_073_741_824;

export interface CreateAppOptions {
  databaseProbe: DatabaseProbe;
  db: DbClient;
  /** Override for the SPA's static root — tests point this at a fixture. */
  staticRoot?: string;
  /** Git commit surfaced at /health (config.ts). Defaults to "unknown" for tests. */
  commit?: string;
  /** `/library` route wiring (specs/017-ingestion-pipeline). Test-safe defaults below. */
  library?: {
    uploadMaxBytes?: number;
    uploadDir?: string;
    onEnqueued?: () => void;
  };
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
export function createApp({
  databaseProbe,
  db,
  staticRoot,
  commit = "unknown",
  library,
}: CreateAppOptions) {
  const app = new Hono();
  const validateSession = createValidateSession(db);
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.route("/health", createHealthRoute(databaseProbe, commit));
  app.route("/api/echo", createEchoRoute());
  app.route("/auth", createAuthRoutes({ db, validateSession }));
  app.route(
    "/library",
    createLibraryRoutes({
      db,
      validateSession,
      uploadMaxBytes: library?.uploadMaxBytes ?? DEFAULT_UPLOAD_MAX_BYTES,
      uploadDir: library?.uploadDir ?? os.tmpdir(),
      onEnqueued: library?.onEnqueued ?? (() => {}),
    }),
  );
  // Mounted LAST (plan D2): the SPA fallback must never shadow the routes
  // above, whose unknown sub-paths keep returning the structured JSON 404.
  app.use("*", createStaticMiddleware(staticRoot));
  return app;
}

export type App = ReturnType<typeof createApp>;
