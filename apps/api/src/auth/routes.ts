/**
 * Operator sign-in/out routes (decision D13, specs/007-v3-skeleton/contracts/
 * api.md "Auth"). The only credential in the system is one password, stored
 * as a bcrypt hash in OPERATOR_PASSWORD_HASH — no user table, no lookup step.
 *
 * Doctrine: every credential-shaped failure (missing password, wrong type,
 * bad password, absent session) returns the identical 401 "Sign-in failed."
 * body, so responses leak nothing about which part failed.
 */
import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";

import { errorEnvelope } from "../errors";
import { isSessionAuthenticated, markSessionAuthenticated } from "./session";

export interface AuthRoutesOptions {
  operatorPasswordHash: string;
}

interface LoginBody {
  password?: string;
}

export function registerAuthRoutes(app: FastifyInstance, opts: AuthRoutesOptions): void {
  app.post<{ Body: LoginBody }>("/api/auth/login", async (request, reply) => {
    const password = request.body?.password;
    // compareSync (blocking) is acceptable here on purpose: single operator,
    // login is rare, and bcrypt's cost is the built-in brute-force throttle.
    const ok = typeof password === "string" && bcrypt.compareSync(password, opts.operatorPasswordHash);

    if (!ok) {
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
      return;
    }

    markSessionAuthenticated(request);
    return { ok: true };
  });

  // Logout is exempt from the auth guard and idempotent: deleting a session
  // that never existed still returns ok, so a client with a stale/tampered
  // cookie can always reset to a clean state.
  app.post("/api/auth/logout", async (request) => {
    request.session.delete();
    return { ok: true };
  });

  // Session probe for the (future) UI. The global guard in session.ts already
  // 401s unauthenticated callers; the explicit check here is belt-and-braces
  // so this route stays correct even if its guard exemption ever changes.
  app.get("/api/auth/session", async (request, reply) => {
    if (!isSessionAuthenticated(request)) {
      reply.code(401).send(errorEnvelope("unauthorized", "Sign-in failed."));
      return;
    }
    return { authenticated: true };
  });
}
