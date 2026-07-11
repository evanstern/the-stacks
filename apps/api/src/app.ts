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
import { resolveModelRole } from "@stacks/core";
import { createEmbedClient } from "@stacks/ingestion";
import {
  resolveRetrievalConfig,
  type QueryEmbedder,
  type ResolvedRetrievalConfig,
} from "@stacks/retrieval";

import { registerSession } from "./auth/session";
import { errorEnvelope, statusForErrorClass } from "./errors";
import { registerHealthRoutes } from "./health";
import { registerIngestionRoutes } from "./ingestion/routes";
import { registerRetrievalRecordRoutes, registerRetrievalRoutes } from "./retrieval/routes";
import { registerSkeletonCheckRoutes } from "./skeleton-checks/routes";

export interface AppDeps {
  db: ReturnType<typeof createDbClient>["db"];
  pool: ReturnType<typeof createDbClient>["pool"];
  operatorPasswordHash: string;
  sessionSecret: string;
  sessionCookieSecure: boolean;
  /** Ingestion intake cap; env-resolved in main.ts, injectable in tests. */
  maxUploadBytes?: number;
  /** Query embedder for retrieval (spec 010); injectable in tests. Absent,
   *  a REAL sidecar-backed embedder is built LAZILY on first search — so
   *  suites that never touch retrieval carry no embedding env burden. */
  embedQuery?: QueryEmbedder;
  /** Resolved retrieval config; defaults from process.env (all knobs have
   *  safe defaults — resolution cannot fail on an empty env). */
  retrievalConfig?: ResolvedRetrievalConfig;
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

    // Fastify schema-validation failures (malformed query/body per a route's
    // declared schema) are the caller's shape error — an honest 400, never the
    // scrubbed 500 the catch-all would turn them into (009, contracts/api.md).
    // error.message here is ajv's generated text (e.g. "querystring/limit must
    // be integer") — mechanical, parameter-scoped, safe for the wire.
    if (typeof error.code === "string" && error.code === "FST_ERR_VALIDATION") {
      reply
        .code(statusForErrorClass("invalid_input"))
        .send(errorEnvelope("invalid_input", error.message));
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
  await registerIngestionRoutes(app, { db: deps.db, maxUploadBytes: deps.maxUploadBytes });
  registerRetrievalRoutes(app, {
    db: deps.db,
    embedQuery: deps.embedQuery ?? lazySidecarEmbedder(),
    config: deps.retrievalConfig ?? resolveRetrievalConfig(process.env),
  });
  registerRetrievalRecordRoutes(app, { db: deps.db });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}

/** The production QueryEmbedder: the 008 embed client pointed at the same
 * EMBEDDING_* role the index was stamped with (research R4 — one role, so
 * query and index can only drift if config drifts, and the engine's stamp
 * check catches exactly that). Built lazily on FIRST use: tests that never
 * search never pay the env-resolution cost. */
function lazySidecarEmbedder(): QueryEmbedder {
  let embedder: QueryEmbedder | null = null;
  return async (text: string) => {
    if (!embedder) {
      const role = resolveModelRole("embedding");
      const client = createEmbedClient({
        config: role,
        maxBatch: 1,
        timeoutMs: Number(process.env.ML_REQUEST_TIMEOUT_MS ?? 15000),
      });
      embedder = async (query: string) => {
        const [vector] = await client.embedAll([query]);
        return {
          vector: vector!,
          provider: role.provider,
          model: role.modelId,
          dimensions: role.dimensions,
        };
      };
    }
    return embedder(text);
  };
}
