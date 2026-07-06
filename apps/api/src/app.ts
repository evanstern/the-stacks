/**
 * API composition root: assembles the Fastify app from injected dependencies
 * (db, pool, auth material) so tests can build an app against a scratch DB
 * without touching process.env. Process concerns — env validation, migrations,
 * listen — live in main.ts; everything HTTP-shaped is wired here.
 *
 * Two boundary rules are enforced in this file and nowhere else:
 *  1. DomainError -> HTTP status mapping happens ONLY in setErrorHandler below
 *     (FR-018, specs/007-v3-skeleton/contracts/api.md). Handlers and the worker
 *     throw domain classes; they never pick status codes.
 *  2. Registration order matters: registerSession installs the GLOBAL auth
 *     hook, so health routes register before it (stay unauthenticated by
 *     construction) and all later route modules are guarded automatically.
 */
import { DomainError } from "@stacks/core";
import type { createDbClient } from "@stacks/db";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { registerAuthRoutes } from "./auth/routes";
import { registerSession } from "./auth/session";
import { errorEnvelope, statusForErrorClass } from "./errors";
import { registerHealthRoutes } from "./health";
import { registerSkeletonCheckRoutes } from "./skeleton-checks/routes";

export interface AppDeps {
  db: ReturnType<typeof createDbClient>["db"];
  pool: ReturnType<typeof createDbClient>["pool"];
  operatorPasswordHash: string;
  sessionSecret: string;
  sessionCookieSecure: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.decorate("deps", deps);

  // The single seam where domain vocabulary becomes HTTP vocabulary. Checks run
  // most-specific first: known DomainError, then Fastify's own content-type
  // errors, then a scrubbed 500 catch-all.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof DomainError) {
      reply.code(statusForErrorClass(error.class)).send(errorEnvelope(error.class, error.message));
      return;
    }

    // Fastify's built-in content-type/body errors (FST_ERR_CTP_*) are the
    // "payload/type the system doesn't handle" case (FR-018).
    if (typeof error.code === "string" && error.code.startsWith("FST_ERR_CTP")) {
      reply
        .code(statusForErrorClass("unsupported_type"))
        .send(errorEnvelope("unsupported_type", "Unsupported content type."));
      return;
    }

    if (typeof error.statusCode === "number" && error.statusCode === 415) {
      reply
        .code(statusForErrorClass("unsupported_type"))
        .send(errorEnvelope("unsupported_type", "Unsupported content type."));
      return;
    }

    // internal_fault deliberately splits the audience: full diagnostics go to
    // operator-side logs; the HTTP body carries only a scrubbed generic message
    // (FR-018 — never leak stack traces or internals to the wire).
    request.log.error({ err: error }, "unhandled error");
    reply
      .code(statusForErrorClass("internal_fault"))
      .send(errorEnvelope("internal_fault", "An internal error occurred."));
  });

  // Order is load-bearing: health first (pre-auth), then the session plugin +
  // global guard, then everything that must sit behind it.
  registerHealthRoutes(app, deps);
  await registerSession(app, {
    sessionSecret: deps.sessionSecret,
    sessionCookieSecure: deps.sessionCookieSecure,
  });
  registerAuthRoutes(app, { operatorPasswordHash: deps.operatorPasswordHash });
  registerSkeletonCheckRoutes(app, { db: deps.db });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
