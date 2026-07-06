import bcrypt from "bcrypt";
import { beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const PASSWORD = "correct-password";
const SESSION_SECRET = "a".repeat(32);

function workingPool() {
  return { query: async () => ({ rows: [{ "?column?": 1 }] }) } as any;
}

function failingPool() {
  return {
    query: async () => {
      throw new Error("connection refused");
    },
  } as any;
}

function throwingDb() {
  return {
    select: () => {
      throw new Error("boom: unexpected query failure");
    },
  } as any;
}

async function loginCookie(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { password: PASSWORD } });
  return String(login.headers["set-cookie"]).split(";")[0];
}

// Pins every error class in the mapping table (contracts/api.md, FR-018): at
// least one contract test per class, each hitting the real HTTP boundary.
describe("error-mapping contract", () => {
  it("unknown_thing -> 404: GET on a run id that doesn't exist", async () => {
    const app = await buildApp({
      db: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) } as any,
      pool: workingPool(),
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();
    const cookie = await loginCookie(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/skeleton-checks/00000000-0000-0000-0000-000000000000",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "unknown_thing", message: expect.any(String) } });
  });

  it("unsupported_type -> 415: non-JSON content type on a JSON POST route", async () => {
    const app = await buildApp({
      db: {} as any,
      pool: workingPool(),
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      // Fastify has a built-in parser for text/plain; application/xml has no
      // registered parser at all, which is what actually triggers FST_ERR_CTP.
      headers: { "content-type": "application/xml" },
      payload: "<password>whatever</password>",
    });

    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ error: { code: "unsupported_type", message: expect.any(String) } });
  });

  it("dependency_down -> 503: DB pool stubbed down on /ready", async () => {
    const app = await buildApp({
      db: {} as any,
      pool: failingPool(),
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: { code: "dependency_down", message: expect.any(String) },
      checks: { database: "failed", migrations: "applied" },
    });
  });

  it("internal_fault -> 500 with a scrubbed message, not the raw error", async () => {
    const app = await buildApp({
      db: throwingDb(),
      pool: workingPool(),
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: SESSION_SECRET,
      sessionCookieSecure: false,
    });
    await app.ready();
    const cookie = await loginCookie(app);

    const res = await app.inject({ method: "GET", url: "/api/skeleton-checks", headers: { cookie } });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toEqual({ error: { code: "internal_fault", message: expect.any(String) } });
    expect(body.error.message).not.toContain("boom");
  });
});
