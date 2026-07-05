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

    request.log.error({ err: error }, "unhandled error");
    reply
      .code(statusForErrorClass("internal_fault"))
      .send(errorEnvelope("internal_fault", "An internal error occurred."));
  });

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
