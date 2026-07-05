import secureSession from "@fastify/secure-session";
import type { FastifyInstance } from "fastify";

import { errorEnvelope } from "../errors";

const COOKIE_NAME = "stacks_v3_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Routes reachable without a session — health/ready (unauthenticated per FR-003)
// plus login/logout, which must work precisely when there is no valid session yet.
const EXEMPT = new Set(["GET /health", "GET /ready", "POST /api/auth/login", "POST /api/auth/logout"]);

export interface SessionPluginOptions {
  sessionSecret: string;
  sessionCookieSecure: boolean;
}

export function markSessionAuthenticated(request: { session: { set(key: string, value: unknown): void } }): void {
  request.session.set("operator", true);
  request.session.set("issuedAt", Date.now());
}

export function isSessionAuthenticated(request: { session: { get(key: string): unknown } }): boolean {
  return request.session.get("operator") === true;
}

export async function registerSession(app: FastifyInstance, opts: SessionPluginOptions): Promise<void> {
  await app.register(secureSession, {
    cookieName: COOKIE_NAME,
    secret: opts.sessionSecret,
    salt: "stacks-v3-salt16",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: opts.sessionCookieSecure,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  });

  // A global onRequest hook (not preHandler) so it also applies to routes that
  // don't exist yet — "every other route requires a valid session" (contracts/api.md).
  app.addHook("onRequest", async (request, reply) => {
    const key = `${request.method} ${request.routeOptions?.url ?? request.url}`;
    if (EXEMPT.has(key)) {
      return;
    }

    if (!isSessionAuthenticated(request)) {
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
    }
  });
}
