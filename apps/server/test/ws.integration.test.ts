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
import { readFrom } from "../src/events/log.js";
import { users } from "../src/schema/auth.js";
import { createGateway } from "../src/ws/gateway.js";
import type { RecordedEventFrame } from "../src/ws/protocol.js";

/**
 * Integration tests for the WebSocket gateway (spec 006, Phases 2-3), against
 * a REAL listening server and REAL WebSocket clients — reusing spec 004/005's
 * loud-skip harness (research D2's precedent): fan-out and ordering are not
 * observable through a mocked socket, and this project has already shipped a
 * process-killing crash to `main` because every test used fakes and none
 * touched the real path (the T016 finding).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  console.warn(
    `\n⚠️  SKIPPING apps/server/test/ws.integration.test.ts — no reachable database ` +
      `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). These are the ` +
      `WebSocket gateway integration tests (spec 006 Phases 2-3); a skip here proves NOTHING about ` +
      `authentication, append-before-broadcast, fan-out, or ordering. Start one with: ` +
      `docker compose up -d db, then set ` +
      `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:${process.env.DB_PORT ?? "5432"}/<db>\n`,
  );
}

function requireDb() {
  if (!db) {
    throw new Error(
      "ws gateway integration tests require a reachable database",
    );
  }
  return db;
}

afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)("ws gateway (Phases 2-3, integration)", () => {
  let server: ServerType;
  let port: number;
  let gateway: ReturnType<typeof createGateway>;
  const openSockets: WebSocket[] = [];

  beforeAll(async () => {
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: requireDb(),
    });
    gateway = createGateway({
      db: requireDb(),
      validateSession: createValidateSession(requireDb()),
    });

    server = await new Promise<ServerType>((resolve) => {
      const srv = serve({ fetch: app.fetch, port: 0 }, (info) => {
        port = info.port;
        resolve(srv);
      });
    });
    gateway.attach(server);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  afterEach(() => {
    for (const ws of openSockets) {
      ws.terminate();
    }
    openSockets.length = 0;
  });

  /** Fresh signed-in user per test, via the real auth functions — not HTTP. */
  async function createTestUser() {
    const username = `ws-test-${randomUUID()}`;
    const passwordHash = await hashPassword("correct horse battery staple");
    const [user] = await requireDb()
      .insert(users)
      .values({ username, displayName: username, role: "player", passwordHash })
      .returning();
    const session = await createSession(requireDb(), user.id);
    return { userId: user.id as string, token: session.token };
  }

  function connect(token?: string): WebSocket {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: token ? { Cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
    });
    // A refused upgrade (research D4) surfaces as an async 'error' after
    // the test's own once-listeners have already settled; without a
    // permanent listener here, afterEach's terminate() on that dead socket
    // throws it as an unhandled exception. Tests assert refusal via
    // waitForUpgradeRefusal, not this listener.
    ws.on("error", () => {});
    openSockets.push(ws);
    return ws;
  }

  function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
  }

  /** Resolves with the HTTP status of a refused upgrade (research D4 — the socket never opens). */
  function waitForUpgradeRefusal(ws: WebSocket): Promise<number> {
    return new Promise((resolve, reject) => {
      ws.once("unexpected-response", (_req, res) =>
        resolve(res.statusCode ?? 0),
      );
      ws.once("open", () =>
        reject(new Error("expected the upgrade to be refused, but it opened")),
      );
    });
  }

  function send(ws: WebSocket, frame: unknown): void {
    ws.send(JSON.stringify(frame));
  }

  function collectFrames(
    ws: WebSocket,
    count: number,
    timeoutMs = 3000,
  ): Promise<RecordedEventFrame[]> {
    return new Promise((resolve, reject) => {
      const frames: RecordedEventFrame[] = [];
      const timer = setTimeout(() => {
        ws.off("message", onMessage);
        reject(
          new Error(
            `collectFrames: timed out with ${frames.length}/${count} frames`,
          ),
        );
      }, timeoutMs);
      function onMessage(data: WebSocket.RawData) {
        frames.push(JSON.parse(data.toString()));
        if (frames.length === count) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(frames);
        }
      }
      ws.on("message", onMessage);
    });
  }

  /** Asserts no message arrives on `ws` within `timeoutMs` (FR-008 session isolation). */
  function assertNoMessage(ws: WebSocket, timeoutMs = 300): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off("message", onMessage);
        resolve();
      }, timeoutMs);
      function onMessage(data: WebSocket.RawData) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        reject(new Error(`expected no message, got: ${data.toString()}`));
      }
      ws.on("message", onMessage);
    });
  }

  /** No replay-complete/ack exists yet (Phase 5) — poll the in-process registry instead of the wire. */
  async function waitForSubscribers(
    sessionId: string,
    count: number,
  ): Promise<void> {
    const deadline = Date.now() + 2000;
    while (gateway.registry.subscriberCount(sessionId) < count) {
      if (Date.now() > deadline) {
        throw new Error(
          `waitForSubscribers: never reached ${count} subscribers for ${sessionId}`,
        );
      }
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  describe("Phase 2 — authenticated connections", () => {
    it("an authenticated client's upgrade succeeds and the socket opens", async () => {
      const { token } = await createTestUser();
      const ws = connect(token);
      await expect(waitForOpen(ws)).resolves.toBeUndefined();
    });

    it("an unauthenticated client's upgrade is refused with 401 — the socket never opens (research D4)", async () => {
      const ws = connect(undefined);
      await expect(waitForUpgradeRefusal(ws)).resolves.toBe(401);
    });

    it("a client with a bogus session token is refused with 401", async () => {
      const ws = connect("not-a-real-token");
      await expect(waitForUpgradeRefusal(ws)).resolves.toBe(401);
    });
  });

  describe("US1 — fan-out (T009-T012)", () => {
    it("T009: two subscribers to one session both receive a message, including the sender", async () => {
      const { token, userId } = await createTestUser();
      const sessionId = randomUUID();
      const a = connect(token);
      const b = connect(token);
      await Promise.all([waitForOpen(a), waitForOpen(b)]);

      send(a, { type: "subscribe", sessionId });
      send(b, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 2);

      const [framesA, framesB] = await Promise.all([
        collectFrames(a, 1),
        collectFrames(b, 1),
        (async () => {
          send(a, {
            type: "send",
            sessionId,
            eventType: "chat",
            payload: { text: "hello" },
            payloadVersion: 1,
          });
        })(),
      ]);

      for (const frames of [framesA, framesB]) {
        expect(frames).toHaveLength(1);
        expect(frames[0]).toMatchObject({
          type: "event",
          event: {
            sessionId,
            actor: userId,
            type: "chat",
            payload: { text: "hello" },
            payloadVersion: 1,
            visibility: "public",
          },
        });
        expect(typeof frames[0].event.seq).toBe("number");
      }
    });

    it("T010: a subscriber to session A receives nothing when a message is sent in session B (FR-008)", async () => {
      const { token } = await createTestUser();
      const sessionA = randomUUID();
      const sessionB = randomUUID();
      const inA = connect(token);
      const inB = connect(token);
      await Promise.all([waitForOpen(inA), waitForOpen(inB)]);

      send(inA, { type: "subscribe", sessionId: sessionA });
      send(inB, { type: "subscribe", sessionId: sessionB });
      await Promise.all([
        waitForSubscribers(sessionA, 1),
        waitForSubscribers(sessionB, 1),
      ]);

      const [framesA] = await Promise.all([
        collectFrames(inA, 1),
        assertNoMessage(inB),
        (async () => {
          send(inA, {
            type: "send",
            sessionId: sessionA,
            eventType: "chat",
            payload: {},
            payloadVersion: 1,
          });
        })(),
      ]);

      expect(framesA[0].event.sessionId).toBe(sessionA);
    });

    it("T011: after delivery, reading the log finds the event — delivery and durability are the same act (SC-002)", async () => {
      const { token, userId } = await createTestUser();
      const sessionId = randomUUID();
      const ws = connect(token);
      await waitForOpen(ws);
      send(ws, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      const [frames] = await Promise.all([
        collectFrames(ws, 1),
        (async () => {
          send(ws, {
            type: "send",
            sessionId,
            eventType: "narration",
            payload: { text: "the door creaks open" },
            payloadVersion: 1,
          });
        })(),
      ]);

      const delivered = frames[0].event;
      const stored = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        sessionId,
        seq: delivered.seq,
        actor: userId,
        type: "narration",
        payload: { text: "the door creaks open" },
        payloadVersion: 1,
      });
    });

    it("T012: several concurrent senders — every subscriber observes the same sequence (FR-007)", async () => {
      const { token: senderToken } = await createTestUser();
      const { token: subscriberToken } = await createTestUser();
      const sessionId = randomUUID();
      const SENDER_COUNT = 3;
      const PER_SENDER = 5;
      const TOTAL = SENDER_COUNT * PER_SENDER;

      const senders = Array.from({ length: SENDER_COUNT }, () =>
        connect(senderToken),
      );
      const subA = connect(subscriberToken);
      const subB = connect(subscriberToken);
      await Promise.all([...senders, subA, subB].map(waitForOpen));

      for (const ws of [...senders, subA, subB]) {
        send(ws, { type: "subscribe", sessionId });
      }
      await waitForSubscribers(sessionId, SENDER_COUNT + 2);

      const [framesA, framesB] = await Promise.all([
        collectFrames(subA, TOTAL, 5000),
        collectFrames(subB, TOTAL, 5000),
        (async () => {
          await Promise.all(
            senders.flatMap((ws, senderIdx) =>
              Array.from({ length: PER_SENDER }, (_, i) =>
                Promise.resolve().then(() =>
                  send(ws, {
                    type: "send",
                    sessionId,
                    eventType: "narration",
                    payload: { senderIdx, i },
                    payloadVersion: 1,
                  }),
                ),
              ),
            ),
          );
        })(),
      ]);

      const seqsA = framesA.map((f) => f.event.seq);
      const seqsB = framesB.map((f) => f.event.seq);
      const sortedA = [...seqsA].sort((x, y) => x - y);

      // FR-007: one order for everyone — both subscribers saw the same
      // sequence of positions, in the same order.
      expect(seqsA).toEqual(seqsB);
      // The log itself is gapless and duplicate-free for this session.
      expect(new Set(seqsA).size).toBe(TOTAL);
      expect(sortedA).toEqual(Array.from({ length: TOTAL }, (_, i) => i + 1));
    });
  });
});
