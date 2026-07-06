/**
 * Stateless sealed-cookie sessions for the single-operator model (decision
 * D13, research R5, specs/007-v3-skeleton/contracts/api.md "Auth"). There is
 * no session table: @fastify/secure-session encrypts the session payload into
 * the cookie itself, keyed from SESSION_SECRET. A tampered or foreign cookie
 * simply fails decryption and reads back as an empty session — no explicit
 * signature-check branch exists or is needed.
 *
 * This file also owns the deny-by-default guard: a GLOBAL onRequest hook that
 * 401s everything outside the EXEMPT set. New routes are protected the moment
 * they are registered; forgetting auth on a route is not a possible bug here.
 */
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

// Single-operator doctrine: the session carries no user id, just an
// "operator: true" claim. issuedAt is recorded for future observability, not
// for expiry — cookie maxAge is the sole lifetime mechanism.
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
    // secure-session requires the salt to be EXACTLY 16 chars — it feeds key
    // derivation from SESSION_SECRET. Changing it invalidates every existing
    // session cookie (harmless here: the operator just signs in again).
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
  // Consequence worth knowing: an unauthenticated request to an unknown path
  // gets 401, not 404 — the API reveals nothing about its route map.
  app.addHook("onRequest", async (request, reply) => {
    // routeOptions.url is the route PATTERN (e.g. "/api/x/:id"), so exemption
    // can't be spoofed by crafting a matching raw URL; raw url is only the
    // fallback for unmatched (404-bound) requests, which are never exempt.
    const key = `${request.method} ${request.routeOptions?.url ?? request.url}`;
    if (EXEMPT.has(key)) {
      return;
    }

    if (!isSessionAuthenticated(request)) {
      // Same fixed "Sign-in failed." body as every credential failure — the
      // response never distinguishes missing vs. tampered vs. expired session.
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
    }
  });
}
