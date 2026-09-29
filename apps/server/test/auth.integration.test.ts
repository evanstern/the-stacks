import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { redeemInvitation } from "../src/auth/invitations.js";
import { hashPassword } from "../src/auth/password.js";
import { createOperator, hasOperator } from "../src/auth/provisioning.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { generateToken, hashToken } from "../src/auth/tokens.js";
import { createDb, probeReachable } from "../src/db.js";
import { authSessions, invitations, users } from "../src/schema/auth.js";

/** Shape of the `{ user: ... }` body returned by sign-in, /auth/me, and redeem. */
interface AuthUserBody {
  user: { id: string; displayName: string; role: string };
}

/** Shape of the body returned by `POST /auth/invitations`. */
interface InvitationIssuedBody {
  token: string;
  expiresAt: string;
}

/**
 * Integration tests for session auth (spec 005, US1–US4), reusing spec
 * 004's loud-skip harness (T010): a silent skip and a fake pass are both
 * green, so this notice is what makes "proved nothing" look different
 * from "proved something" (research D2's event-log precedent).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/auth.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). These are the ` +
    `session-auth integration tests (spec 005 US1/US2); a skip here proves NOTHING about ` +
    `sign-in, refusal, expiry, or the validateSession seam. Start one with: ` +
    `docker compose up -d db, then set ` +
    `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:${process.env.DB_PORT ?? "5432"}/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
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

describe.skipIf(!reachable)("session auth (US1-US4, integration)", () => {
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
  async function createTestUser(
    password: string,
    role: "operator" | "player" = "player",
  ) {
    const username = `test-${randomUUID()}`;
    const passwordHash = await hashPassword(password);
    const [user] = await requireDb()
      .insert(users)
      .values({ username, displayName: username, role, passwordHash })
      .returning();
    return { user, username, password };
  }

  function extractCookie(res: Response): string {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("expected a Set-Cookie header");
    return setCookie.split(";")[0];
  }

  /** Directly seeds a redeemable invitation, bypassing the HTTP layer. */
  async function createTestInvitation(createdBy: string) {
    const token = generateToken();
    await requireDb()
      .insert(invitations)
      .values({
        tokenHash: hashToken(token),
        createdBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    return token;
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
    const body = (await res.json()) as AuthUserBody;
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
    const body = (await me.json()) as AuthUserBody;
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
    const meBody = (await me.json()) as AuthUserBody;

    const validateSession = createValidateSession(requireDb());
    const direct = await validateSession(token);

    expect(direct).toEqual({ userId: user.id, role: "player" });
    expect(meBody.user.id).toBe(direct?.userId);
  });

  it("T027/T028: create-operator provisions the first operator (who can sign in), and refuses a second run (US3 scenario 2)", async () => {
    const db = requireDb();

    // "operator" is a global singleton by design (single-tenant, research
    // D6) — unlike every other fixture in this file, it can't be
    // freshened per test, and the users table is shared and not reset
    // across runs. Only assert the positive, sign-in-capable path when
    // this run is actually the one that wins first provisioning.
    const [existingOperator] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "operator"))
      .limit(1);

    if (!existingOperator) {
      const username = `operator-${randomUUID()}`;
      const password = "operator password long enough";
      const created = await createOperator(db, { username, password });
      expect(created.created).toBe(true);
      expect(await hasOperator(db)).toBe(true);

      const res = await requireApp().request("/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as AuthUserBody).user.role).toBe("operator");
    }

    // T028: whether this run just created the first operator above, or
    // one already existed from an earlier run against this database, a
    // second attempt must refuse — never a second operator, never an
    // overwrite.
    const second = await createOperator(db, {
      username: `operator-${randomUUID()}`,
      password: "a completely different password",
    });
    expect(second.created).toBe(false);
  });

  it("T032: an operator can issue an invitation and a player cannot (FR-012, 403)", async () => {
    const { username, password } = await createTestUser(
      "operator password long enough",
      "operator",
    );
    const operatorSignIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const operatorCookie = extractCookie(operatorSignIn);

    const issued = await requireApp().request("/auth/invitations", {
      method: "POST",
      headers: { cookie: operatorCookie },
    });
    expect(issued.status).toBe(201);
    const issuedBody = (await issued.json()) as InvitationIssuedBody;
    expect(typeof issuedBody.token).toBe("string");
    expect(typeof issuedBody.expiresAt).toBe("string");

    const player = await createTestUser("player password long enough");
    const playerSignIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: player.username,
        password: player.password,
      }),
    });
    const playerCookie = extractCookie(playerSignIn);

    const refused = await requireApp().request("/auth/invitations", {
      method: "POST",
      headers: { cookie: playerCookie },
    });
    expect(refused.status).toBe(403);
  });

  it("T033: redemption creates a player account that can sign in with the password they chose", async () => {
    const { user: operator } = await createTestUser(
      "operator password long enough",
      "operator",
    );
    const token = await createTestInvitation(operator.id);
    const username = `redeemed-${randomUUID()}`;
    const password = "the password the player picked";

    const redeem = await requireApp().request("/auth/invitations/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        username,
        displayName: "Redeemed Player",
        password,
      }),
    });
    expect(redeem.status).toBe(201);
    const redeemBody = (await redeem.json()) as AuthUserBody;
    expect(redeemBody.user.role).toBe("player");
    // Redemption signs the new player in immediately (contracts/http-auth.md).
    expect(redeem.headers.get("set-cookie")).toContain("session=");

    const signIn = await requireApp().request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    expect(signIn.status).toBe(200);
  });

  it("T034: redeeming an already-redeemed or expired invitation is refused", async () => {
    const { user: operator } = await createTestUser(
      "operator password long enough",
      "operator",
    );

    const redeemedToken = await createTestInvitation(operator.id);
    const firstRedeem = await requireApp().request("/auth/invitations/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: redeemedToken,
        username: `already-${randomUUID()}`,
        displayName: "Already Redeemed",
        password: "some password entirely",
      }),
    });
    expect(firstRedeem.status).toBe(201);

    const secondRedeem = await requireApp().request(
      "/auth/invitations/redeem",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: redeemedToken,
          username: `already-${randomUUID()}`,
          displayName: "Second Attempt",
          password: "some other password",
        }),
      },
    );
    expect(secondRedeem.status).toBe(400);

    // A token whose expires_at is already in the past — inserted
    // directly, bypassing createTestInvitation's 7-day default.
    const expiredToken = generateToken();
    await requireDb()
      .insert(invitations)
      .values({
        tokenHash: hashToken(expiredToken),
        createdBy: operator.id,
        expiresAt: new Date(Date.now() - 1000),
      });
    const expiredRedeem = await requireApp().request(
      "/auth/invitations/redeem",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: expiredToken,
          username: `expired-${randomUUID()}`,
          displayName: "Too Late",
          password: "yet another password",
        }),
      },
    );
    expect(expiredRedeem.status).toBe(400);
  });

  it("TASK-0032: redeeming with a taken username is a conflict, not a 500", async () => {
    const { user: operator } = await createTestUser(
      "operator password long enough",
      "operator",
    );
    const { username: takenUsername } = await createTestUser(
      "existing account password",
    );

    const token = await createTestInvitation(operator.id);
    const directResult = await redeemInvitation(requireDb(), {
      token,
      username: takenUsername,
      displayName: "Conflicting Player",
      password: "some password entirely",
    });
    expect(directResult).toEqual({ ok: false, reason: "conflict" });

    const tokenUpper = await createTestInvitation(operator.id);
    const upperResult = await redeemInvitation(requireDb(), {
      token: tokenUpper,
      username: takenUsername.toUpperCase(),
      displayName: "Conflicting Player Upper",
      password: "some password entirely",
    });
    expect(upperResult).toEqual({ ok: false, reason: "conflict" });

    const routeToken = await createTestInvitation(operator.id);
    const conflictRedeem = await requireApp().request(
      "/auth/invitations/redeem",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: routeToken,
          username: takenUsername,
          displayName: "Conflicting Player Route",
          password: "some password entirely",
        }),
      },
    );
    expect(conflictRedeem.status).toBe(409);
    const conflictBody = (await conflictRedeem.json()) as {
      error: { kind: string };
    };
    expect(conflictBody.error.kind).toBe("conflict");

    // The invitation stayed unspent through both failed attempts: it
    // still redeems with a fresh username.
    const retryRedeem = await requireApp().request("/auth/invitations/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: routeToken,
        username: `retry-${randomUUID()}`,
        displayName: "Retry Player",
        password: "some password entirely",
      }),
    });
    expect(retryRedeem.status).toBe(201);
  });

  it("T035: simultaneous redemptions of one invitation create exactly one account (SC-005)", async () => {
    const db = requireDb();
    const { user: operator } = await createTestUser(
      "operator password long enough",
      "operator",
    );
    const token = await createTestInvitation(operator.id);
    const usernameBase = `race-${randomUUID()}`;

    // TWENTY concurrent redemptions, not two — and read the note below before
    // trusting this test to prove what its name says.
    //
    // T036 (revert-and-watch-it-fail) was run by the orchestrator against a
    // read-then-write implementation. THIS TEST STILL PASSED, 3/3, even at 20
    // racers. What caught the bug was T034 (redeeming an already-redeemed
    // invitation), deterministically.
    //
    // The reason is worth keeping: redemption runs inside `db.transaction`,
    // so Postgres's row lock on the invitation serializes the competing
    // UPDATEs regardless of whether the WHERE clause carries the
    // `redeemed_at IS NULL` guard. The transaction is doing the mutual
    // exclusion; the guard is what makes the LOSER notice it lost. Remove the
    // guard and the loser silently overwrites instead of failing — which
    // shows up as a re-redeemable invitation (T034), not as two accounts.
    //
    // So: this test proves the outcome SC-005 states, and T034 is the test
    // with teeth against this particular defect. Both are kept. The width is
    // still 20 rather than 2 because a narrow concurrency test proves even
    // less, and spec 004 set the precedent at 50 writers for the event log.
    const RACERS = 20;

    // Distinct usernames so a loser can only fail on the INVITATION guard,
    // never on the username's own uniqueness — isolating exactly the
    // mechanism SC-005 is about (research D5).
    const usernames = Array.from(
      { length: RACERS },
      (_, i) => `${usernameBase}-${i}`,
    );
    const outcomes = await Promise.all(
      usernames.map((username, i) =>
        redeemInvitation(db, {
          token,
          username,
          displayName: `Racer ${i}`,
          password: "a racer password long enough",
        }),
      ),
    );

    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toHaveLength(RACERS - 1);

    // The direct, DB-level proof of SC-005: exactly one account exists across
    // every candidate username, regardless of which won. This also proves the
    // losers' speculative account inserts were rolled back — 19 orphan
    // accounts would be a silent data defect the outcome counts above miss.
    const created = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.username, usernames));
    expect(created).toHaveLength(1);
  });
});
