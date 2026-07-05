import { DomainError } from "@stacks/core";
import type { createDbClient } from "@stacks/db";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { errorEnvelope, statusForErrorClass } from "./errors";
import { registerHealthRoutes } from "./health";

export interface AppDeps {
  pool: ReturnType<typeof createDbClient>["pool"];
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: true });

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

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
