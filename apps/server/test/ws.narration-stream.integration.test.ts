import { randomUUID } from "node:crypto";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type { StoredEvent } from "@the-stacks/session-model";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import { SESSION_COOKIE_NAME } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { createDb, probeReachable } from "../src/db.js";
import { createGate } from "../src/gate/index.js";
import { users } from "../src/schema/auth.js";
import { createGateway } from "../src/ws/gateway.js";
import { type Connection, createRegistry } from "../src/ws/registry.js";

/**
 * Spec 108 delivery: per-viewer parts, late-joiner replay after `replay-complete`, `end` before the
 * settled row, buffer cleared on `end`. `canSee(_, "public")` is true for every role today, so no
 * viewer is filtered out; the test pins that the filter runs (a dm-only frame never leaves).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;
if (!reachable) {
  const notice = `\nSKIPPING apps/server/test/ws.narration-stream.integration.test.ts: no reachable database (got ${databaseUrl ?? "<unset>"}).\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}
afterAll(async () => {
  await db?.$client.end();
});

type Frame = { type: string } & Record<string, unknown>;
const JOB = "job-1";
const part = (slot: string, text: string, jobId = JOB) =>
  ({ jobId, slot, text }) as never;
const slots = (f: Frame[]) =>
  f.filter((x) => x.type === "narration-stream").map((x) => x.slot);

describe.skipIf(!reachable)("narration stream delivery (integration)", () => {
  let server: ServerType;
  let port: number;
  let gateway: ReturnType<typeof createGateway>;
  const open: WebSocket[] = [];

  beforeAll(async () => {
    const d = db as NonNullable<typeof db>;
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: d,
    });
    const gate = createGate({ db: d });
    gateway = createGateway({
      db: d,
      validateSession: createValidateSession(d),
      gate,
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
    await new Promise<void>((r) => server.close(() => r()));
  });
  afterEach(() => {
    for (const ws of open) ws.terminate();
    open.length = 0;
  });

  async function client(sessionId: string, seatAsDm = false) {
    const d = db as NonNullable<typeof db>;
    const [user] = await d
      .insert(users)
      .values({
        username: `ns-${randomUUID()}`,
        displayName: "N",
        role: "player",
        passwordHash: await hashPassword("correct horse battery staple"),
      })
      .returning();
    if (seatAsDm) {
      gateway.registry.setSeat(sessionId, { kind: "human", userId: user.id });
    }
    const session = await createSession(d, user.id);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${session.token}` },
    });
    ws.on("error", () => {});
    open.push(ws);
    const frames: Frame[] = [];
    ws.on("message", (x) => frames.push(JSON.parse(x.toString())));
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    ws.send(JSON.stringify({ type: "subscribe", sessionId }));
    await until(() => frames.some((f) => f.type === "replay-complete"));
    return frames;
  }
  async function until(check: () => boolean, ms = 3000) {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error("until: timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  const narrationRow = (sessionId: string): StoredEvent =>
    ({
      sessionId,
      seq: 1,
      actor: "ai:dm",
      type: "narration",
      payload: { text: "x" },
      payloadVersion: 1,
      visibility: "public",
      ts: new Date().toISOString(),
    }) as unknown as StoredEvent;

  it("two players and a human DM receive every part; a late joiner gets the parts so far after replay-complete, then the row, then nothing", async () => {
    const sessionId = randomUUID();
    const dm = await client(sessionId, true);
    const a = await client(sessionId);
    const b = await client(sessionId);
    gateway.streamNarration(sessionId, part("rows", "Check: 15"));
    gateway.streamNarration(sessionId, part("describe", "The shutter gives."));
    for (const f of [dm, a, b]) {
      await until(() => slots(f).length === 2);
      expect(slots(f)).toEqual(["rows", "describe"]);
    }

    const late = await client(sessionId);
    await until(() => slots(late).length === 2);
    const types = late.map((f) => f.type);
    expect(types.indexOf("narration-stream")).toBeGreaterThan(
      types.indexOf("replay-complete"),
    );
    expect(slots(late)).toEqual(["rows", "describe"]);

    gateway.publish(sessionId, [narrationRow(sessionId)]);
    await until(() => late.some((f) => f.type === "event"));
    const after = late.map((f) =>
      f.type === "event" ? "event" : (f.slot ?? f.type),
    );
    expect(after.slice(-2)).toEqual(["end", "event"]);

    // The worker's own trailing `end` is a no-op: the buffer is already cleared.
    gateway.streamNarration(sessionId, part("end", ""));
    gateway.streamNarration(sessionId, part("describe", "stray", "job-old"));
    await new Promise((r) => setTimeout(r, 100));
    expect(slots(late).filter((s) => s === "end")).toHaveLength(1);
  });

  it("a late joiner after `end` gets no parts", async () => {
    const sessionId = randomUUID();
    const first = await client(sessionId);
    gateway.streamNarration(sessionId, part("rows", "r"));
    gateway.streamNarration(sessionId, part("end", ""));
    await until(() => slots(first).length === 2);
    const late = await client(sessionId);
    await new Promise((r) => setTimeout(r, 100));
    expect(slots(late)).toEqual([]);
  });
});

describe("registry narration buffer (no socket)", () => {
  function fake(userId: string, replaying: boolean) {
    const sent: Frame[] = [];
    const conn = {
      socket: {
        OPEN: 1,
        readyState: 1,
        send: (m: string) => sent.push(JSON.parse(m)),
      },
      userId,
      role: "player",
      sessionId: null,
      pendingQueue: replaying ? [] : null,
      replayedThroughSeq: 0,
    } as unknown as Connection;
    return { conn, sent };
  }

  it("skips a mid-replay connection, replays the buffer to it later, and clears on end", () => {
    const reg = createRegistry();
    const live = fake("u1", false);
    const replaying = fake("u2", true);
    reg.subscribe(live.conn, "s");
    reg.subscribe(replaying.conn, "s");
    reg.streamNarration("s", part("rows", "r"));
    reg.streamNarration("s", part("describe", "d"));
    expect(slots(live.sent)).toEqual(["rows", "describe"]);
    expect(replaying.sent).toEqual([]);
    expect(reg.bufferedNarration("s", replaying.conn)).toHaveLength(2);
    reg.streamNarration("s", part("end", ""));
    expect(slots(live.sent)).toEqual(["rows", "describe", "end"]);
    expect(reg.bufferedNarration("s", replaying.conn)).toEqual([]);
  });

  it("a new jobId replaces the buffer; endNarration clears it", () => {
    const reg = createRegistry();
    const c = fake("u1", false);
    reg.subscribe(c.conn, "s");
    reg.streamNarration("s", part("rows", "old", "j1"));
    reg.streamNarration("s", part("rows", "new", "j2"));
    expect(reg.bufferedNarration("s", c.conn).map((f) => f.text)).toEqual([
      "new",
    ]);
    reg.endNarration("s");
    expect(reg.bufferedNarration("s", c.conn)).toEqual([]);
    expect(c.sent.at(-1)).toMatchObject({ slot: "end", jobId: "j2" });
  });
});
