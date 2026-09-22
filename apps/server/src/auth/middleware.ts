import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { SessionIdentity, ValidateSession } from "./session.js";

/** Cookie name carrying the session token (research D4). */
export const SESSION_COOKIE_NAME = "session";

export interface AuthVariables {
  identity: SessionIdentity | null;
}

/**
 * Extracts the session token from the cookie and hands it to
 * `validateSession` — extraction is this middleware's job, validation is
 * the seam's (contracts/validate-session.md). Sets `identity` on the
 * context: the resolved identity, or `null` when there's no cookie or the
 * session isn't live. Route handlers decide whether a `null` identity is
 * an error (e.g. `/auth/me`) — this middleware never rejects a request
 * itself, so it can also be used to *optionally* attach identity.
 */
export function createAuthMiddleware(validateSession: ValidateSession) {
  return async function authMiddleware(
    c: Context<{ Variables: AuthVariables }>,
    next: Next,
  ) {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    c.set("identity", token ? await validateSession(token) : null);
    await next();
  };
}
