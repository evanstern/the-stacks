import { eq } from "drizzle-orm";
import type { createDb } from "../db.js";
import { authSessions, users } from "../schema/auth.js";
import { generateToken, hashToken } from "./tokens.js";

export type DbClient = ReturnType<typeof createDb>;

/** The two roles FR-002 requires (constitution: "Operator plus invited players"). */
export type Role = "operator" | "player";

export interface SessionIdentity {
  userId: string;
  role: Role;
}

/** Absolute, 30-day lifetime (research D3) — never extended by validateSession (FR-008). */
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Creates a session for `userId`. Stores only the token's hash (research D2). */
export async function createSession(
  db: DbClient,
  userId: string,
): Promise<CreatedSession> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(authSessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Ends the session identified by `token`. Deletes rather than marks — there
 * is nothing to audit in M0 and a deleted row can't be mistaken for live
 * (data-model.md). Deleting a session that's already gone is a success,
 * not an error: sign-out is idempotent (contracts/http-auth.md).
 */
export async function endSession(db: DbClient, token: string): Promise<void> {
  await db
    .delete(authSessions)
    .where(eq(authSessions.tokenHash, hashToken(token)));
}

/**
 * The fixed seam (contracts/validate-session.md), binding for TASK-0015.
 * Returns a closure bound to `db` so the function itself matches the
 * frozen signature exactly — `(token: string) => Promise<{userId, role} | null>`
 * — with no `Request`, socket, or cookie header, since the WebSocket
 * upgrade handler has no Hono context to carry one through. `db` is
 * captured once at wiring time instead of threaded as a parameter on
 * every call, so both the HTTP middleware and the WS handler can share
 * one bound instance (FR-007 — exactly one validation operation).
 *
 * - Same `null` for unknown, malformed, expired, and signed-out tokens
 *   (FR-004, FR-006) — no case here distinguishes them.
 * - No side effects: does not touch `expires_at` (FR-008, SC-007).
 * - Throws (does not catch) when the datastore is unreachable (FR-009) —
 *   the query below is deliberately not wrapped in try/catch, so a
 *   connection failure propagates instead of being reported as `null`.
 */
export function createValidateSession(db: DbClient) {
  return async function validateSession(
    token: string,
  ): Promise<SessionIdentity | null> {
    const [row] = await db
      .select({
        userId: authSessions.userId,
        expiresAt: authSessions.expiresAt,
        role: users.role,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(eq(authSessions.tokenHash, hashToken(token)))
      .limit(1);

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return { userId: row.userId, role: row.role as Role };
  };
}

export type ValidateSession = ReturnType<typeof createValidateSession>;
