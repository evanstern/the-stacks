import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type { StoredEvent } from "@the-stacks/session-model";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import { SESSION_COOKIE_NAME } from "../src/auth/middleware.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { users } from "../src/schema/auth.js";
import { createGateway } from "../src/ws/gateway.js";
import type { ErrorFrame, RecordedEventFrame } from "../src/ws/protocol.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  readRows,
  startScene,
  TAMSIN_USER,
  type World,
} from "./dm/world.js";

/**
 * Spec 102 Phase 3 (AC #1, AC #2 human seat): the `intent` request through the live gate and the
 * real WebSocket gateway. The fake provider has no scripted calls, so any model call throws.
 */

loudSkip("gate.intent.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

// 7 initiative dice (tamsin first), then d20 15 to hit, then damage dice.
const DICE = [20, 1, 1, 1, 1, 1, 1, 15, 4, 4, 4, 4];

let port = 0;
let server: ServerType;
const sockets: WebSocket[] = [];

async function turnWorld(): Promise<World> {
  const w = await createWorld({ dice: DICE });
  await startScene(w);
  const { result } = await w.runResolve({
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: { id: "00000000-0000-4000-8000-000000000a60" },
  });
  if (!result.ok) throw new Error(`turn mode failed: ${result.error.message}`);
  return w;
}

describe.skipIf(!db)("gate intents over WebSocket (database)", () => {
  let world: World;
  const seen: StoredEvent[][] = [];

  beforeAll(async () => {
    world = await turnWorld();
    world.gate.onAppended((_sid, events) => seen.push(events));
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: db as NonNullable<typeof db>,
    });
    const gateway = createGateway({
      db: db as NonNullable<typeof db>,
      validateSession: createValidateSession(db as NonNullable<typeof db>),
      gate: world.gate,
    });
    world.gate.onAppended(gateway.publish);
    server = await new Promise<ServerType>((resolve) => {
      const srv = serve({ fetch: app.fetch, port: 0 }, (info) => {
        port = info.port;
        resolve(srv);
      });
    });
    gateway.attach(server);
    await db
      ?.insert(users)
      .values({
        id: TAMSIN_USER,
        username: `intent-tamsin-${TAMSIN_USER.slice(-4)}`,
        displayName: "Tamsin",
        role: "player",
        passwordHash: "x",
      })
      .onConflictDoNothing();
  });
  afterEach(() => {
    for (const s of sockets) s.terminate();
    sockets.length = 0;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function connect(): Promise<WebSocket> {
    const session = await createSession(
      db as NonNullable<typeof db>,
      TAMSIN_USER,
    );
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${session.token}` },
    });
    ws.on("error", () => {});
    sockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    ws.send(JSON.stringify({ type: "subscribe", sessionId: world.sessionId }));
    return ws;
  }

  const frames = (ws: WebSocket) => {
    const out: (RecordedEventFrame | ErrorFrame)[] = [];
    ws.on("message", (d) => {
      const f = JSON.parse(d.toString()) as { type: string };
      if (f.type === "event" || f.type === "error") out.push(f as never);
    });
    return out;
  };
  const until = async (fn: () => boolean) => {
    const end = Date.now() + 3000;
    while (!fn()) {
      if (Date.now() > end) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  it("AC #1: a confirmed player attack appends engine rows then the carrier, no model call", async () => {
    const ws = await connect();
    const got = frames(ws);
    const before = (await readRows(world)).length;
    ws.send(
      JSON.stringify({
        type: "send",
        sessionId: world.sessionId,
        eventType: "intent",
        payloadVersion: 1,
        payload: {
          intent: {
            id: "atk-1",
            kind: "attack",
            actor: { kind: "pc", id: "tamsin" },
            targets: [{ kind: "actor", id: "goblin-2" }],
            params: { weapon: "Longsword" },
            source: "composer",
            commit: "confirmed",
          },
        },
      }),
    );
    await until(() =>
      got.some((f) => f.type === "event" && f.event.type === "intent.recorded"),
    );
    const rows = (await readRows(world)).slice(before);
    expect(rows.at(-1)?.type).toBe("intent.recorded");
    expect(rows.some((r) => r.type.startsWith("attack."))).toBe(true);
    expect(rows.at(-1)?.payload).toMatchObject({
      outcome: "settled",
      intent: { id: "atk-1" },
    });
    // The strict fake provider throws on any call; none was scripted or made.
    expect(world.scripted.remaining().calls).toBeDefined();
    expect(
      Object.values(world.scripted.remaining().calls).every((n) => n === 0),
    ).toBe(true);
  });

  it("a player cannot send another player's actor: forbidden NOT_YOUR_ACTOR", async () => {
    const ws = await connect();
    const got = frames(ws);
    ws.send(
      JSON.stringify({
        type: "send",
        sessionId: world.sessionId,
        eventType: "intent",
        payloadVersion: 1,
        payload: {
          intent: {
            id: "atk-2",
            kind: "attack",
            actor: { kind: "pc", id: "kestrel" },
            targets: [{ kind: "actor", id: "goblin-2" }],
            params: { weapon: "Longsword" },
            source: "composer",
            commit: "confirmed",
          },
        },
      }),
    );
    await until(() => got.some((f) => f.type === "error"));
    expect(got.find((f) => f.type === "error")).toMatchObject({
      kind: "forbidden",
      code: "NOT_YOUR_ACTOR",
    });
  });
});

describe.skipIf(!db)("human-seat ruling proposals (database)", () => {
  const humanSeat = async () => {
    const w = await turnWorld();
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    if (!seat.ok) throw new Error(`seat refused: ${seat.refusal.code}`);
    return w;
  };
  const tamsin = {
    kind: "human",
    userId: TAMSIN_USER,
    role: "player",
  } as const;
  const send = (w: World, id: string, kind: string, text: string) =>
    w.as(tamsin, {
      kind: "intent",
      intent: {
        id,
        kind,
        actor: { kind: "pc", id: "tamsin" },
        params: kind === "check" ? { skill: "athletics" } : {},
        text,
        source: "composer",
        commit: "confirmed",
      },
    });

  it("an attempt under a human seat writes the carrier then proposal.created; approve closes it", async () => {
    const w = await humanSeat();
    const before = (await readRows(w)).length;
    const res = await send(w, "try-1", "attempt", "I swing from the rope.");
    expect(res.ok).toBe(true);
    const rows = (await readRows(w)).slice(before);
    expect(rows.map((r) => r.type)).toEqual([
      "intent.recorded",
      "proposal.created",
    ]);
    const p = await w.projections();
    const view = p.proposals.find((v) => v.kind === "intent");
    expect(view?.status).toBe("pending");
    const approved = await w.as(operator, {
      kind: "proposal.approve",
      proposalId: view?.proposalId,
    });
    expect(approved.ok).toBe(true);
    const after = await w.projections();
    expect(after.proposals.find((v) => v.kind === "intent")?.status).toBe(
      "approved",
    );
    expect(after.intents.find((v) => v.id === "try-1")?.status).toBe(
      "answered",
    );
  });

  it("a difficulty ask cannot be approved; a set_dc ruling closes it", async () => {
    const w = await humanSeat();
    const res = await send(w, "chk-1", "check", "I shove the shutter.");
    expect(res.ok).toBe(true);
    const view = (await w.projections()).proposals.find(
      (v) => v.kind === "intent",
    );
    const approve = await w.as(operator, {
      kind: "proposal.approve",
      proposalId: view?.proposalId,
    });
    expect(approve.ok ? "ok" : approve.refusal.code).toBe(
      "PROPOSAL_NOT_APPROVABLE",
    );
    const ruled = await w.as(operator, {
      kind: "intent",
      intent: {
        id: "dc-1",
        kind: "ruling",
        actor: { kind: "dm" },
        params: {
          requestId: "chk-1",
          decision: "accept",
          difficulty: "medium",
        },
        source: "console",
        commit: "confirmed",
      },
    });
    expect(ruled.ok ? "ok" : ruled.refusal.code).toBe("ok");
    const after = await w.projections();
    expect(after.proposals.find((v) => v.kind === "intent")?.status).toBe(
      "approved",
    );
  });

  it("reject closes the proposal rejected", async () => {
    const w = await humanSeat();
    await send(w, "try-2", "attempt", "I leap the stream.");
    const view = (await w.projections()).proposals.find(
      (v) => v.kind === "intent",
    );
    const rejected = await w.as(operator, {
      kind: "proposal.reject",
      proposalId: view?.proposalId,
      reason: "Not possible.",
    });
    expect(rejected.ok).toBe(true);
    const after = await w.projections();
    expect(after.proposals.find((v) => v.kind === "intent")?.status).toBe(
      "rejected",
    );
    expect(after.intents.find((v) => v.id === "try-2")?.status).toBe(
      "answered",
    );
  });
});
