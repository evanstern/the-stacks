import type { FastifyInstance } from "fastify";

import type { AppDeps } from "./app";
import { errorEnvelope } from "./errors";

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await deps.pool.query("select 1");
    } catch {
      reply.code(503).send({
        ...errorEnvelope("dependency_down", "Database is unavailable."),
        checks: { database: "failed", migrations: "applied" },
      });
      return;
    }

    return { status: "ready", checks: { database: "ready", migrations: "applied" } };
  });
}
