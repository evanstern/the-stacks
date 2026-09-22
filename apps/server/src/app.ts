import { Hono } from "hono";
import { errorHandler, notFoundHandler } from "./errors.js";

/**
 * Builds the configured app WITHOUT binding a port (research D3), so tests
 * can exercise it in-process. The entrypoint (index.ts) is what serves it.
 */
export function createApp() {
  const app = new Hono();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;
