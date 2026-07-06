import bcrypt from "bcrypt";
import { beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const PASSWORD = "correct-password";
const SESSION_SECRET = "a".repeat(32);

function fakePool() {
  return { query: async () => ({ rows: [{ "?column?": 1 }] }) } as any;
}

describe("auth contract", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      db: {} as any, // unused: every test here is blocked by the auth guard before a route handler runs
      pool: fakePool(),
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();
  });

  function extractCookie(setCookieHeader: string | string[] | undefined): string | undefined {
    const header = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    return header?.split(";")[0];
  }

  it("health/ready are reachable unauthenticated", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
  });

  it("GET /api/auth/session without a cookie is 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/session" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      error: { code: "unauthorized", message: "Sign-in failed." },
    });
  });

  it("wrong password returns 401 with the fixed non-revealing body and sets no cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "wrong-password" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      error: { code: "unauthorized", message: "Sign-in failed." },
    });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("correct password logs in, sets a sealed HttpOnly cookie, and the session becomes valid", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({ ok: true });

    const cookieHeader = login.headers["set-cookie"];
    expect(cookieHeader).toBeDefined();
    expect(String(cookieHeader)).toMatch(/HttpOnly/i);
    expect(String(cookieHeader)).toMatch(/SameSite=Lax/i);

    const cookie = extractCookie(cookieHeader);

    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie: cookie! },
    });

    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({ authenticated: true });
  });

  it("a tampered cookie is treated as no session (401)", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    const cookie = extractCookie(login.headers["set-cookie"])!;
    const tampered = cookie.slice(0, -4) + "abcd";

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie: tampered },
    });

    expect(res.statusCode).toBe(401);
  });

  it("logout clears the session so a subsequent session check is 401", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    const cookie = extractCookie(login.headers["set-cookie"])!;

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });

    const logoutCookie = extractCookie(logout.headers["set-cookie"]);
    const session = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      headers: { cookie: logoutCookie ?? cookie },
    });
    expect(session.statusCode).toBe(401);
  });

  it("every other route requires a valid session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/skeleton-checks" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      error: { code: "unauthorized", message: "Sign-in failed." },
    });
  });
});
