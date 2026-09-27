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
import type { ErrorFrame, RecordedEventFrame } from "../src/ws/protocol.js";

/**
 * Integration tests for the WebSocket gateway (spec 006, Phases 2-7), against
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
  const notice =
    `\n⚠️  SKIPPING apps/server/test/ws.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). These are the ` +
    `WebSocket gateway integration tests (spec 006 Phases 2-3); a skip here proves NOTHING about ` +
    `authentication, append-before-broadcast, fan-out, or ordering. Start one with: ` +
    `docker compose up -d db, then set ` +
    `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:${process.env.DB_PORT ?? "5432"}/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
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

describe.skipIf(!reachable)("ws gateway (Phases 2-7, integration)", () => {
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

  /**
   * Collects `count` frames of one `type` from `ws`, ignoring any other
   * frame type in between. Every `subscribe` now sends a `replay-complete`
   * frame (Phase 5) in addition to whatever `event`/`error` frames a test
   * cares about — filtering by type here is what keeps a test's assertion
   * about "the next event" from racing against that administrative frame
   * (contracts/ws-protocol.md: replay-complete is not required for
   * correctness, so a caller is free to ignore it, as these helpers do).
   */
  function collectFramesOfType<T extends { type: string }>(
    ws: WebSocket,
    type: T["type"],
    count: number,
    timeoutMs = 3000,
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const frames: T[] = [];
      const timer = setTimeout(() => {
        ws.off("message", onMessage);
        reject(
          new Error(
            `collectFramesOfType(${type}): timed out with ${frames.length}/${count} frames`,
          ),
        );
      }, timeoutMs);
      function onMessage(data: WebSocket.RawData) {
        const frame = JSON.parse(data.toString()) as { type: string };
        if (frame.type !== type) return;
        frames.push(frame as T);
        if (frames.length === count) {
          clearTimeout(timer);
          ws.off("message", onMessage);
          resolve(frames);
        }
      }
      ws.on("message", onMessage);
    });
  }

  function collectFrames(
    ws: WebSocket,
    count: number,
    timeoutMs = 3000,
  ): Promise<RecordedEventFrame[]> {
    return collectFramesOfType<RecordedEventFrame>(
      ws,
      "event",
      count,
      timeoutMs,
    );
  }

  /** Asserts no `event` frame arrives on `ws` within `timeoutMs` (FR-008 session isolation) — a `replay-complete` from `ws`'s own subscribe is not a leak and is ignored. */
  function assertNoMessage(ws: WebSocket, timeoutMs = 300): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off("message", onMessage);
        resolve();
      }, timeoutMs);
      function onMessage(data: WebSocket.RawData) {
        const frame = JSON.parse(data.toString()) as { type: string };
        if (frame.type !== "event") return;
        clearTimeout(timer);
        ws.off("message", onMessage);
        reject(new Error(`expected no message, got: ${data.toString()}`));
      }
      ws.on("message", onMessage);
    });
  }

  /** Registry membership is synchronous within `subscribe`'s pre-replay step, so this resolves before replay/live delivery begins — poll it instead of the wire when a test needs "both subscribers are joined" before racing sends. */
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

  describe("US2 — server authority (T016-T019)", () => {
    it("T016: a malformed frame produces an error frame, the connection stays open, and nothing is appended (FR-003)", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const ws = connect(token);
      await waitForOpen(ws);

      const errors = collectFramesOfType<ErrorFrame>(ws, "error", 1);
      ws.send("{not json");
      const [error] = await errors;
      expect(error.kind).toBe("validation");

      // The connection stayed open: a well-formed frame right after still works.
      send(ws, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);
      expect(ws.readyState).toBe(ws.OPEN);

      const stored = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(stored).toHaveLength(0);
    });

    it("T017: a send claiming a different actor records the connection's own identity (FR-005, SC-004)", async () => {
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
            eventType: "chat",
            payload: {},
            payloadVersion: 1,
            actor: "someone-else-entirely",
          });
        })(),
      ]);
      expect(frames[0].event.actor).toBe(userId);
    });

    it("T018: client-supplied seq and ts are ignored; the server assigns its own (FR-006)", async () => {
      const { token } = await createTestUser();
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
            eventType: "chat",
            payload: {},
            payloadVersion: 1,
            seq: 999,
            ts: "2020-01-01T00:00:00.000Z",
          });
        })(),
      ]);
      expect(frames[0].event.seq).not.toBe(999);
      expect(frames[0].event.ts).not.toBe("2020-01-01T00:00:00.000Z");
    });

    it("T019: a refused message leaves no trace — no gap, no stray event in the log (US2 scenario 4)", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const ws = connect(token);
      await waitForOpen(ws);
      send(ws, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      // The first send is awaited to completion before the refusals and
      // the second send fire — concurrent sends over one socket race for
      // append's advisory lock and aren't guaranteed to commit in send
      // order (T031 hit exactly this), so this barrier is what makes
      // "the log has no gap" a claim about a known, checkable order.
      const [firstFrame] = await Promise.all([
        collectFrames(ws, 1),
        Promise.resolve().then(() =>
          send(ws, {
            type: "send",
            sessionId,
            eventType: "chat",
            payload: { n: 1 },
            payloadVersion: 1,
          }),
        ),
      ]);

      const errors = collectFramesOfType<ErrorFrame>(ws, "error", 2);
      ws.send("{not json");
      send(ws, { type: "send", sessionId }); // missing required fields — refused
      await errors;

      const [secondFrame] = await Promise.all([
        collectFrames(ws, 1),
        Promise.resolve().then(() =>
          send(ws, {
            type: "send",
            sessionId,
            eventType: "chat",
            payload: { n: 2 },
            payloadVersion: 1,
          }),
        ),
      ]);

      const seq1 = firstFrame[0].event.seq;
      const seq2 = secondFrame[0].event.seq;
      expect(seq2).toBe(seq1 + 1); // no gap: the two refusals appended nothing

      const stored = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(stored.map((e) => e.seq)).toEqual([seq1, seq2]);
    });
  });

  describe("US3 — the replay/live boundary (T021-T024)", () => {
    it("T021: subscribing from position N delivers every event after N, in order, and none at or before N", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const seeder = connect(token);
      await waitForOpen(seeder);
      send(seeder, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      const HISTORY = 5;
      const seedFrames = collectFrames(seeder, HISTORY);
      for (let i = 0; i < HISTORY; i++) {
        send(seeder, {
          type: "send",
          sessionId,
          eventType: "tick",
          payload: { i },
          payloadVersion: 1,
        });
      }
      const seeded = await seedFrames;
      const cursor = seeded[2].event.seq; // partway through history

      const late = connect(token);
      await waitForOpen(late);
      const replayed = collectFrames(late, HISTORY - 3);
      send(late, { type: "subscribe", sessionId, afterSeq: cursor });
      const got = await replayed;

      expect(got.map((f) => f.event.seq)).toEqual(
        seeded.slice(3).map((f) => f.event.seq),
      );
    });

    it("T022: subscribing from a cursor while another client is actively sending yields ascending, no-duplicate, no-gap positions (SC-003, quickstart step 2)", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const sender = connect(token);
      await waitForOpen(sender);
      send(sender, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      const SEED = 3;
      const seedFrames = collectFrames(sender, SEED);
      for (let i = 0; i < SEED; i++) {
        send(sender, {
          type: "send",
          sessionId,
          eventType: "tick",
          payload: { i },
          payloadVersion: 1,
        });
      }
      const seeded = await seedFrames;
      const cursor = seeded[seeded.length - 1].event.seq;

      // Keep the session under sustained, high-concurrency write pressure
      // across the WHOLE subscribe call, not just a burst fired before it
      // starts — the boundary this test exists for (research D1) is a
      // narrow window between one internal step and the next inside the
      // server's subscribe handling, and only a genuinely continuous flood
      // of commits gives an append a realistic chance of landing in it. A
      // one-shot burst tends to land entirely before or entirely after
      // that window rather than straddling it (T023 found exactly this: a
      // single-socket burst version of this test passed even against a
      // deliberately broken implementation; a single-socket 2ms-interval
      // version — one append at a time — still did, because that window
      // is a synchronous, no-await gap and only a genuinely concurrent
      // commit landing inside it can expose the bug).
      const STREAM_MS = 400;
      // Bounded well under the DB pool's connection cap (10) — each
      // socket keeps exactly one append in flight at a time (see
      // `hammer` below), so concurrency is ~HAMMER_SENDERS, not a
      // flood. An earlier attempt let every socket re-fire on ANY
      // subscribed event (not just its own), which fanned out
      // exponentially across sockets and exhausted the pool.
      const HAMMER_SENDERS = 5;
      let streaming = true;
      const hammerSockets = Array.from({ length: HAMMER_SENDERS }, (_, i) => ({
        ws: connect(token),
        tag: `hammer-${i}`,
      }));
      await Promise.all(hammerSockets.map((h) => waitForOpen(h.ws)));
      for (const { ws } of hammerSockets) {
        send(ws, { type: "subscribe", sessionId });
      }
      await waitForSubscribers(sessionId, 1 + HAMMER_SENDERS);

      function hammer(ws: WebSocket, tag: string): void {
        if (!streaming) return;
        send(ws, {
          type: "send",
          sessionId,
          eventType: "tick",
          payload: { tag },
          payloadVersion: 1,
        });
        // Fire the next one only on receipt of THIS socket's own echo
        // (identified by `tag`, since every hammer socket shares one
        // userId) — one append in flight per socket, so HAMMER_SENDERS
        // sockets keep the advisory lock saturated with back-to-back
        // concurrent commits for the whole window without unbounded
        // concurrency.
        function onMessage(data: WebSocket.RawData) {
          const frame = JSON.parse(data.toString()) as RecordedEventFrame;
          if (
            frame.type === "event" &&
            (frame.event.payload as { tag?: string } | undefined)?.tag === tag
          ) {
            ws.off("message", onMessage);
            hammer(ws, tag);
          }
        }
        ws.on("message", onMessage);
      }
      for (const { ws, tag } of hammerSockets) hammer(ws, tag);

      // Let the flood get going before the late subscriber joins mid-flood.
      await new Promise((r) => setTimeout(r, 20));

      const late = connect(token);
      await waitForOpen(late);
      const lateFrames: RecordedEventFrame[] = [];
      late.on("message", (data: WebSocket.RawData) => {
        const frame = JSON.parse(data.toString()) as { type: string };
        if (frame.type === "event")
          lateFrames.push(frame as RecordedEventFrame);
      });
      send(late, { type: "subscribe", sessionId, afterSeq: cursor });

      // Let the flood run for the full window, then stop it and give
      // delivery a quiet period, so the log has stopped growing before
      // comparing.
      await new Promise((r) => setTimeout(r, STREAM_MS));
      streaming = false;
      await new Promise((r) => setTimeout(r, 300));

      const stored = await readFrom(requireDb(), {
        sessionId,
        afterSeq: cursor,
        limit: 1000,
      });
      const expectedSeqs = stored.map((e) => e.seq);
      const positions = lateFrames.map((f) => f.event.seq);

      expect(positions).toEqual([...positions].sort((a, b) => a - b)); // ascending
      expect(new Set(positions).size).toBe(positions.length); // no duplicate
      // no gap between the replayed range and the live range: exactly what
      // the log holds after the cursor, verified directly (quickstart step 2)
      expect(positions).toEqual(expectedSeqs);
    });

    it("T024: subscribing with no cursor replays from the beginning; subscribing from the newest position delivers nothing but stays live (US3 scenarios 3-4)", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const seeder = connect(token);
      await waitForOpen(seeder);
      send(seeder, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      const HISTORY = 3;
      const seedFrames = collectFrames(seeder, HISTORY);
      for (let i = 0; i < HISTORY; i++) {
        send(seeder, {
          type: "send",
          sessionId,
          eventType: "tick",
          payload: { i },
          payloadVersion: 1,
        });
      }
      const seeded = await seedFrames;
      const newest = seeded[seeded.length - 1].event.seq;

      // No cursor -> replays from the beginning.
      const fromStart = connect(token);
      await waitForOpen(fromStart);
      const fromStartFrames = collectFrames(fromStart, HISTORY);
      send(fromStart, { type: "subscribe", sessionId });
      const got = await fromStartFrames;
      expect(got.map((f) => f.event.seq)).toEqual(
        seeded.map((f) => f.event.seq),
      );

      // From the newest position -> nothing replayed.
      const fromNewest = connect(token);
      await waitForOpen(fromNewest);
      send(fromNewest, { type: "subscribe", sessionId, afterSeq: newest });
      await assertNoMessage(fromNewest);

      // ...and it is simply live from here.
      const liveFrame = collectFrames(fromNewest, 1);
      send(seeder, {
        type: "send",
        sessionId,
        eventType: "tick",
        payload: { later: true },
        payloadVersion: 1,
      });
      const [live] = await liveFrame;
      expect(live.event.seq).toBe(newest + 1);
    });
  });

  describe("US4 — visibility filtering at the single send point (T028-T031)", () => {
    it("T028: a public event reaches every subscriber", async () => {
      const { token: senderToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const sessionId = randomUUID();
      const sender = connect(senderToken);
      const other = connect(otherToken);
      await Promise.all([waitForOpen(sender), waitForOpen(other)]);
      send(sender, { type: "subscribe", sessionId });
      send(other, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 2);

      const [senderFrames, otherFrames] = await Promise.all([
        collectFrames(sender, 1),
        collectFrames(other, 1),
        (async () => {
          send(sender, {
            type: "send",
            sessionId,
            eventType: "chat",
            payload: {},
            payloadVersion: 1,
            visibility: "public",
          });
        })(),
      ]);
      expect(senderFrames).toHaveLength(1);
      expect(otherFrames).toHaveLength(1);
    });

    it("T029: a restricted event reaches only its named recipient, and nothing is sent in its place to anyone else (FR-011)", async () => {
      const { token: senderToken } = await createTestUser();
      const { token: recipientToken, userId: recipientId } =
        await createTestUser();
      const { token: bystanderToken } = await createTestUser();
      const sessionId = randomUUID();
      const sender = connect(senderToken);
      const recipient = connect(recipientToken);
      const bystander = connect(bystanderToken);
      await Promise.all([sender, recipient, bystander].map(waitForOpen));
      for (const ws of [sender, recipient, bystander]) {
        send(ws, { type: "subscribe", sessionId });
      }
      await waitForSubscribers(sessionId, 3);

      const [recipientFrames] = await Promise.all([
        collectFrames(recipient, 1),
        assertNoMessage(bystander),
        assertNoMessage(sender), // the sender is not the named recipient either
        (async () => {
          send(sender, {
            type: "send",
            sessionId,
            eventType: "whisper",
            payload: { text: "psst" },
            payloadVersion: 1,
            visibility: recipientId,
          });
        })(),
      ]);
      expect(recipientFrames[0].event.visibility).toBe(recipientId);
    });

    it("T030: replay applies the same visibility filter as live delivery (US4 scenario 3)", async () => {
      const { token: recipientToken, userId: recipientId } =
        await createTestUser();
      const { token: bystanderToken } = await createTestUser();
      const sessionId = randomUUID();

      const recipient = connect(recipientToken);
      await waitForOpen(recipient);
      send(recipient, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 1);

      const seedFrame = collectFrames(recipient, 1);
      send(recipient, {
        type: "send",
        sessionId,
        eventType: "whisper",
        payload: { text: "for your eyes only" },
        payloadVersion: 1,
        visibility: recipientId,
      });
      const [seeded] = await seedFrame;

      // Fresh connections, fresh subscriptions from the beginning — this
      // is what a reconnect's replay looks like, not the live path above.
      const recipientReplay = connect(recipientToken);
      const bystanderReplay = connect(bystanderToken);
      await Promise.all([
        waitForOpen(recipientReplay),
        waitForOpen(bystanderReplay),
      ]);

      const recipientReplayFrames = collectFrames(recipientReplay, 1);
      send(recipientReplay, { type: "subscribe", sessionId });
      const [replayed] = await recipientReplayFrames;
      expect(replayed.event.seq).toBe(seeded.event.seq);

      // The bystander's replay withholds it too — not just the live path.
      const bystanderNoMessage = assertNoMessage(bystanderReplay);
      send(bystanderReplay, { type: "subscribe", sessionId });
      await bystanderNoMessage;
    });

    it("T031: a filtered recipient's received positions may have gaps — that is correct, not a missed event (US4 scenario 4, research D2)", async () => {
      const { token: senderToken, userId: senderId } = await createTestUser();
      const { token: recipientToken } = await createTestUser();
      const sessionId = randomUUID();
      const sender = connect(senderToken);
      const recipient = connect(recipientToken);
      await Promise.all([waitForOpen(sender), waitForOpen(recipient)]);
      send(sender, { type: "subscribe", sessionId });
      send(recipient, { type: "subscribe", sessionId });
      await waitForSubscribers(sessionId, 2);

      const recipientFrames = collectFrames(recipient, 4);

      // The sender is subscribed too and is entitled to see every one of
      // these (public, or restricted to itself), so its own receipt is a
      // sync barrier: awaiting it before the next send fixes the log's
      // order deterministically. Concurrent sends over one socket race for
      // append's advisory lock and are NOT guaranteed to land in send
      // order otherwise (same non-determinism T012 exercises directly) —
      // without this barrier this test would assert an order the server
      // never promised.
      const visibleSeqs: number[] = [];
      const hiddenSeqs: number[] = [];
      for (const restricted of [false, false, true, false, false]) {
        const [frames] = await Promise.all([
          collectFrames(sender, 1),
          Promise.resolve().then(() =>
            send(sender, {
              type: "send",
              sessionId,
              eventType: restricted ? "whisper" : "chat",
              payload: {},
              payloadVersion: 1,
              ...(restricted ? { visibility: senderId } : {}),
            }),
          ),
        ]);
        (restricted ? hiddenSeqs : visibleSeqs).push(frames[0].event.seq);
      }

      const got = await recipientFrames;
      expect(got.map((f) => f.event.seq)).toEqual(visibleSeqs);
      // The gap is real: the withheld position sits strictly between two
      // delivered ones, not off at either end where it could pass for
      // "nothing sent yet" instead of "one event hidden".
      expect(hiddenSeqs[0]).toBeGreaterThan(visibleSeqs[1]);
      expect(hiddenSeqs[0]).toBeLessThan(visibleSeqs[2]);
    });
  });

  describe("Phase 7 — polish (T034)", () => {
    it("T034: killing a subscriber abruptly mid-broadcast does not stop delivery to the survivors (FR-012, SC-007)", async () => {
      const { token } = await createTestUser();
      const sessionId = randomUUID();
      const doomed = connect(token);
      const survivorA = connect(token);
      const survivorB = connect(token);
      await Promise.all([doomed, survivorA, survivorB].map(waitForOpen));
      for (const ws of [doomed, survivorA, survivorB]) {
        send(ws, { type: "subscribe", sessionId });
      }
      await waitForSubscribers(sessionId, 3);

      doomed.terminate(); // abrupt — not a clean close

      const [framesA, framesB] = await Promise.all([
        collectFrames(survivorA, 1),
        collectFrames(survivorB, 1),
        (async () => {
          // Give the abrupt termination a moment to surface as a dead
          // socket before the broadcast that should route around it.
          await new Promise((r) => setTimeout(r, 50));
          send(survivorA, {
            type: "send",
            sessionId,
            eventType: "chat",
            payload: {},
            payloadVersion: 1,
          });
        })(),
      ]);
      expect(framesA).toHaveLength(1);
      expect(framesB).toHaveLength(1);
    });
  });
});
