/**
 * Liveness/readiness probes (FR-002/FR-003, specs/007-v3-skeleton/contracts/
 * api.md). These are the only unauthenticated GET routes — they register
 * before the session guard in app.ts and are listed in its exemption set, so
 * orchestrators (compose healthchecks) can probe without credentials.
 *
 * /health = process is up. /ready = process can serve real traffic, which
 * here means the DB answers. "migrations: applied" is reported as a constant
 * because main.ts runs migrations before listen (research R10): if this
 * route is reachable at all, the schema is current by construction.
 */
import type { FastifyInstance } from "fastify";

import type { AppDeps } from "./app";
import { errorEnvelope } from "./errors";

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    // Raw pool probe (not the ORM): the cheapest possible "is Postgres there"
    // signal, and it must throw — not error-map — so we can shape a 503 body
    // that carries the per-check breakdown alongside the standard envelope.
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
