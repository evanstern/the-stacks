import { randomUUID } from "node:crypto";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import { SESSION_COOKIE_NAME } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { createDb, probeReachable } from "../src/db.js";
import { createGate } from "../src/gate/index.js";
import { createPresence } from "../src/presence/index.js";
import { users } from "../src/schema/auth.js";
import { createGateway } from "../src/ws/gateway.js";
import type { PresenceFrame } from "../src/ws/protocol.js";

/**
 * Presence over a real WebSocket server (specs/035-presence, decision-0024),
 * with a short grace window and heartbeat so the bounds are testable.
 */

const GRACE_MS = 150;
const HEARTBEAT_MS = 100;

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\nSKIPPING apps/server/test/ws.presence.integration.test.ts: no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip proves nothing about presence.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

function requireDb() {
  if (!db) throw new Error("presence integration tests require a database");
  return db;
}

afterAll(async () => {
  await db?.$client.end();
});

type Frame = { type: string } & Record<string, unknown>;

/** A client that records every frame it receives. */
interface Client {
  ws: WebSocket;
  frames: Frame[];
  presence(): PresenceFrame[];
}

describe.skipIf(!reachable)("ws presence (integration)", () => {
  let server: ServerType;
  let port: number;
  let gateway: ReturnType<typeof createGateway>;
  const presence = createPresence({ graceMs: GRACE_MS });
  const open: WebSocket[] = [];

  beforeAll(async () => {
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: requireDb(),
    });
    const gate = createGate({ db: requireDb() });
    gateway = createGateway({
      db: requireDb(),
      validateSession: createValidateSession(requireDb()),
      gate,
      presence,
      heartbeatIntervalMs: HEARTBEAT_MS,
    });
    gate.onAppended(gateway.publish);
    server = await new Promise<ServerType>((resolve) => {
      const srv = serve({ fetch: app.fetch, port: 0 }, (info) => {
        port = info.port;
        resolve(srv);
      });
    });
    gateway.attach(server);
  });

  afterAll(async () => {
    presence.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  afterEach(() => {
    for (const ws of open) ws.terminate();
    open.length = 0;
  });

  async function createTestUser(displayName: string) {
    const passwordHash = await hashPassword("correct horse battery staple");
    const [user] = await requireDb()
      .insert(users)
      .values({
        username: `pres-${randomUUID()}`,
        displayName,
        role: "player",
        passwordHash,
      })
      .returning();
    const session = await createSession(requireDb(), user.id);
    return { userId: user.id as string, token: session.token };
  }

  async function connect(token: string): Promise<Client> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    ws.on("error", () => {});
    open.push(ws);
    const frames: Frame[] = [];
    ws.on("message", (data) => frames.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    return {
      ws,
      frames,
      presence: () =>
        frames.filter(
          (f) => f.type === "presence",
        ) as unknown as PresenceFrame[],
    };
  }

  function subscribe(c: Client, sessionId: string, withPresence = true): void {
    c.ws.send(
      JSON.stringify({
        type: "subscribe",
        sessionId,
        ...(withPresence ? { presence: true } : {}),
      }),
    );
  }

  async function until(check: () => boolean, ms = 3000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!check()) {
      if (Date.now() > deadline) throw new Error("until: timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  const names = (f: PresenceFrame | undefined) =>
    (f?.present ?? []).map((e) => e.displayName).sort();
  const last = (c: Client) => c.presence()[c.presence().length - 1];

  it("a second subscriber's arrival reaches the first; snapshot follows replay-complete", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    subscribe(a, sessionId);
    await until(() => a.presence().length >= 1);
    expect(names(last(a))).toEqual(["Ana"]);
    const types = a.frames.map((f) => f.type);
    expect(types.indexOf("presence")).toBeGreaterThan(
      types.indexOf("replay-complete"),
    );

    const b = await connect(bo.token);
    subscribe(b, sessionId);
    await until(() => names(last(a)).length === 2);
    expect(names(last(a))).toEqual(["Ana", "Bo"]);
    await until(() => b.presence().length >= 1);
    expect(names(last(b))).toEqual(["Ana", "Bo"]);
  });

  it("a close reaches the other client within the bound", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    const b = await connect(bo.token);
    subscribe(a, sessionId);
    subscribe(b, sessionId);
    await until(() => names(last(a)).length === 2);
    b.ws.close();
    await until(() => names(last(a)).length === 1, GRACE_MS * 10);
    expect(names(last(a))).toEqual(["Ana"]);
  });

  it("a reconnect inside grace sends no absent snapshot", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    const b = await connect(bo.token);
    subscribe(a, sessionId);
    subscribe(b, sessionId);
    await until(() => names(last(a)).length === 2);
    const before = a.presence().length;
    b.ws.close();
    const b2 = await connect(bo.token);
    subscribe(b2, sessionId);
    await new Promise((r) => setTimeout(r, GRACE_MS * 3));
    expect(a.presence().length).toBe(before);
    expect(names(last(a))).toEqual(["Ana", "Bo"]);
  });

  it("a client that stops answering pings is terminated and goes absent", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    const b = await connect(bo.token);
    subscribe(a, sessionId);
    subscribe(b, sessionId);
    await until(() => names(last(a)).length === 2);
    // Stop answering pings without closing: ws auto-pongs unless disabled.
    (
      b.ws as unknown as { _receiver: { removeAllListeners(e: string): void } }
    )._receiver.removeAllListeners("ping");
    await until(
      () => names(last(a)).length === 1,
      (HEARTBEAT_MS * 3 + GRACE_MS) * 5,
    );
    expect(names(last(a))).toEqual(["Ana"]);
  });

  it("multiple tabs of one user count once and survive one closing", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    const b1 = await connect(bo.token);
    const b2 = await connect(bo.token);
    subscribe(a, sessionId);
    subscribe(b1, sessionId);
    subscribe(b2, sessionId);
    await until(() => names(last(a)).length === 2);
    expect(last(a).present).toHaveLength(2);
    b1.ws.close();
    await new Promise((r) => setTimeout(r, GRACE_MS * 3));
    expect(names(last(a))).toEqual(["Ana", "Bo"]);
  });

  it("a subscribe without presence receives no presence frame (SC-005)", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const sessionId = randomUUID();
    const a = await connect(ana.token);
    subscribe(a, sessionId, false);
    await until(() => a.frames.some((f) => f.type === "replay-complete"));
    const b = await connect(bo.token);
    subscribe(b, sessionId);
    await until(() => b.presence().length >= 1);
    b.ws.close();
    await new Promise((r) => setTimeout(r, GRACE_MS * 3));
    expect(a.presence()).toEqual([]);
  });

  it("re-subscribing to another table leaves the first", async () => {
    const ana = await createTestUser("Ana");
    const bo = await createTestUser("Bo");
    const t1 = randomUUID();
    const t2 = randomUUID();
    const a = await connect(ana.token);
    const b = await connect(bo.token);
    subscribe(a, t1);
    subscribe(b, t1);
    await until(() => names(last(a)).length === 2);
    subscribe(b, t2);
    await until(() => names(last(a)).length === 1, GRACE_MS * 10);
    expect(names(last(a))).toEqual(["Ana"]);
    expect(presence.reader.presentUsers(t2).map((e) => e.displayName)).toEqual([
      "Bo",
    ]);
  });
});
