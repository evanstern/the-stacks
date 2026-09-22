import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { generateToken, hashToken } from "../src/auth/tokens.js";
import { createDb, probeReachable } from "../src/db.js";
import { authSessions, users } from "../src/schema/auth.js";

/**
 * Integration tests for session auth (spec 005, US1 and US2), reusing spec
 * 004's loud-skip harness (T010): a silent skip and a fake pass are both
 * green, so this notice is what makes "proved nothing" look different
 * from "proved something" (research D2's event-log precedent).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  console.warn(
    `\n⚠️  SKIPPING apps/server/test/auth.integration.test.ts — no reachable database ` +
      `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). These are the ` +
      `session-auth integration tests (spec 005 US1/US2); a skip here proves NOTHING about ` +
      `sign-in, refusal, expiry, or the validateSession seam. Start one with: ` +
      `docker compose up -d db, then set ` +
      `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:${process.env.DB_PORT ?? "5432"}/<db>\n`,
  );
}

function requireDb() {
  if (!db) {
    throw new Error("auth integration tests require a reachable database");
  }
  return db;
}

afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)("session auth (US1, US2, integration)", () => {
  const app = reachable
    ? createApp({
        databaseProbe: { reachable: async () => true },
        db: requireDb(),
      })
    : undefined;

  function requireApp() {
    if (!app) throw new Error("app not built — database unreachable");
    return app;
  }

  /** Fresh account per test: the users table is shared and not reset. */
  async function createTestUser(password: string) {
    const username = `test-${randomUUID()}`;
    const passwordHash = await hashPassword(password);
    const [user] = await requireDb()
      .insert(users)
      .values({ username, displayName: username, role: "player", passwordHash })
      .returning();
    return { user, username, password };
  }

  function extractCookie(res: Response): string {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("expected a Set-Cookie header");
    return setCookie.split(";")[0];
  }

  it("T011: successful sign-in returns 200 with a user body and sets a cookie", async () => {
    const { username, password, user } = await createTestUser(
      "correct horse battery staple",
    );

    const res = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({
      id: user.id,
      displayName: user.displayName,
      role: "player",
    });
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("T012: wrong password and unknown username return byte-identical status and body (FR-004, SC-003)", async () => {
    const { username } = await createTestUser("correct horse battery staple");

    const wrongPassword = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "totally wrong" }),
    });
    const unknownUsername = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: `nobody-${randomUUID()}`,
        password: "totally wrong",
      }),
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUsername.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownUsername.json());
  });

  it("T013: a session cookie authenticates a later request to /auth/me", async () => {
    const { username, password, user } = await createTestUser(
      "correct horse battery staple",
    );
    const signIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const cookie = extractCookie(signIn);

    const me = await requireApp().request("/auth/me", {
      headers: { cookie },
    });

    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.user.id).toBe(user.id);
  });

  it("T014: sign-out immediately invalidates the cookie, and is idempotent", async () => {
    const { username, password } = await createTestUser(
      "correct horse battery staple",
    );
    const signIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const cookie = extractCookie(signIn);

    const signOut1 = await requireApp().request("/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    });
    expect(signOut1.status).toBe(204);

    const meAfter = await requireApp().request("/auth/me", {
      headers: { cookie },
    });
    expect(meAfter.status).toBe(401);

    // Second sign-out (already gone) is also a success — idempotent.
    const signOut2 = await requireApp().request("/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    });
    expect(signOut2.status).toBe(204);
  });

  it("T020: validateSession returns {userId, role} for a live session, with no HTTP request object", async () => {
    const { user } = await createTestUser("correct horse battery staple");
    const { token } = await createSession(requireDb(), user.id);
    const validateSession = createValidateSession(requireDb());

    const identity = await validateSession(token);

    expect(identity).toEqual({ userId: user.id, role: "player" });
  });

  it("T021: validateSession returns null for unknown, malformed, signed-out, and expired tokens", async () => {
    const validateSession = createValidateSession(requireDb());
    const { user } = await createTestUser("correct horse battery staple");

    const unknown = await validateSession(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const malformed = await validateSession("not-a-real-token-at-all");

    const { token: signedOutToken } = await createSession(requireDb(), user.id);
    await requireApp().request("/auth/sign-out", {
      method: "POST",
      headers: { cookie: `session=${signedOutToken}` },
    });
    const signedOut = await validateSession(signedOutToken);

    // An already-expired session, inserted directly (createSession always
    // creates a 30-day-future expiry, so this bypasses it deliberately). A
    // fresh random token per run — the table is shared and not reset, so a
    // fixed literal collides with itself across test runs.
    const expiredToken = generateToken();
    await requireDb()
      .insert(authSessions)
      .values({
        tokenHash: hashToken(expiredToken),
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });
    const expired = await validateSession(expiredToken);

    expect(unknown).toBeNull();
    expect(malformed).toBeNull();
    expect(signedOut).toBeNull();
    expect(expired).toBeNull();
  });

  it("T022: validateSession does not extend a session's lifetime (FR-008, SC-007)", async () => {
    const { user } = await createTestUser("correct horse battery staple");
    const { token } = await createSession(requireDb(), user.id);
    const validateSession = createValidateSession(requireDb());

    const [before] = await requireDb()
      .select({ expiresAt: authSessions.expiresAt })
      .from(authSessions)
      .where(eq(authSessions.tokenHash, hashToken(token)));

    await validateSession(token);
    await validateSession(token);
    await validateSession(token);

    const [after] = await requireDb()
      .select({ expiresAt: authSessions.expiresAt })
      .from(authSessions)
      .where(eq(authSessions.tokenHash, hashToken(token)));

    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
  });

  it("T023: HTTP middleware and a direct validateSession call resolve the same session to the same identity (SC-002)", async () => {
    const { username, password, user } = await createTestUser(
      "correct horse battery staple",
    );
    const signIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const cookie = extractCookie(signIn);
    const token = cookie.split("=")[1];

    const me = await requireApp().request("/auth/me", { headers: { cookie } });
    const meBody = await me.json();

    const validateSession = createValidateSession(requireDb());
    const direct = await validateSession(token);

    expect(direct).toEqual({ userId: user.id, role: "player" });
    expect(meBody.user.id).toBe(direct?.userId);
  });
});
