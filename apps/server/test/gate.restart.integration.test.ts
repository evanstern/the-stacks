import { randomUUID } from "node:crypto";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { findProposal } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import { SESSION_COOKIE_NAME } from "../src/auth/middleware.js";
import { hashPassword } from "../src/auth/password.js";
import { createSession, createValidateSession } from "../src/auth/session.js";
import { createDb, probeReachable } from "../src/db.js";
import { createGate } from "../src/gate/index.js";
import { users } from "../src/schema/auth.js";
import { loadProjections } from "../src/session/projections.js";
import { createGateway } from "../src/ws/gateway.js";
import type { RecordedEventFrame } from "../src/ws/protocol.js";

/**
 * AC #9 (spec 029, Phase 5): pending proposals survive a server restart. Server A
 * records them and is closed with its pool; server B is built from nothing but
 * the database and must show the same pending proposals to the DM only.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const admin = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = admin ? await probeReachable(admin.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/gate.restart.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about restart durability of pending proposals.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await admin?.$client.end();
});

function requireUrl(): string {
  if (!databaseUrl) throw new Error("restart test requires a database");
  return databaseUrl;
}

async function createTestUser(role: "operator" | "player") {
  if (!admin) throw new Error("restart test requires a database");
  const username = `restart-${randomUUID()}`;
  const passwordHash = await hashPassword("correct horse battery staple");
  const [user] = await admin
    .insert(users)
    .values({ username, displayName: username, role, passwordHash })
    .returning();
  const session = await createSession(admin, user.id);
  return { userId: user.id as string, token: session.token };
}

async function buildServer() {
  const db = createDb(requireUrl());
  const gate = createGate({ db });
  const gateway = createGateway({
    db,
    validateSession: createValidateSession(db),
    gate,
  });
  gate.onAppended(gateway.publish);
  const app = createApp({ databaseProbe: { reachable: async () => true }, db });
  let port = 0;
  const server = await new Promise<ServerType>((resolve) => {
    const srv = serve({ fetch: app.fetch, port: 0 }, (info) => {
      port = info.port;
      resolve(srv);
    });
  });
  gateway.attach(server);
  const sockets: WebSocket[] = [];
  return {
    db,
    gate,
    port,
    connect(token: string) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      ws.on("error", () => {});
      sockets.push(ws);
      return ws;
    },
    async close() {
      for (const ws of sockets) ws.terminate();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await db.$client.end();
    },
  };
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

/** Collects every event frame until `quietMs` passes with no new frame. */
function collectUntilQuiet(
  ws: WebSocket,
  quietMs = 500,
): Promise<RecordedEventFrame["event"][]> {
  return new Promise((resolve) => {
    const events: RecordedEventFrame["event"][] = [];
    let timer = setTimeout(done, quietMs * 2);
    function done() {
      ws.off("message", onMessage);
      resolve(events);
    }
    function onMessage(data: WebSocket.RawData) {
      const frame = JSON.parse(data.toString()) as RecordedEventFrame;
      if (frame.type === "event") events.push(frame.event);
      clearTimeout(timer);
      timer = setTimeout(done, quietMs);
    }
    ws.on("message", onMessage);
  });
}

const aiDm = { kind: "ai", actor: "ai:dm" } as const;
const narration = (text: string) => ({
  kind: "narration",
  narration: { text, actionIds: [] },
  visibility: "public",
});

describe.skipIf(!reachable)("proposal gate — server restart (AC #9)", () => {
  it("keeps pending proposals, lets the DM approve one, and never shows a player any", async () => {
    const dm = await createTestUser("operator");
    const player = await createTestUser("player");
    const sessionId = randomUUID();

    // Server A: seat the DM, record two ask proposals, then go away.
    const a = await buildServer();
    const seated = await a.gate.handle(
      sessionId,
      { kind: "human", userId: dm.userId, role: "operator" },
      {
        kind: "dm.seat",
        reason: "A human takes the seat",
        after: { kind: "human", userId: dm.userId },
      },
    );
    expect(seated.ok).toBe(true);
    const first = await a.gate.submit(
      sessionId,
      aiDm,
      narration("The vault hums."),
    );
    const second = await a.gate.submit(
      sessionId,
      aiDm,
      narration("A door slams."),
    );
    if (!first.ok || first.outcome !== "pending")
      throw new Error("expected pending");
    if (!second.ok || second.outcome !== "pending")
      throw new Error("expected pending");
    await a.close();

    // Server B: fresh pool, fresh gate, fresh gateway.
    const b = await buildServer();
    try {
      const dmWs = b.connect(dm.token);
      const playerWs = b.connect(player.token);
      await Promise.all([opened(dmWs), opened(playerWs)]);
      const dmEvents = collectUntilQuiet(dmWs);
      const playerEvents = collectUntilQuiet(playerWs);
      dmWs.send(JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 }));
      playerWs.send(
        JSON.stringify({ type: "subscribe", sessionId, afterSeq: 0 }),
      );

      const replayed = await dmEvents;
      expect(replayed.map((e) => e.type)).toEqual([
        "dm.seat.changed",
        "proposal.created",
        "proposal.created",
      ]);
      expect((await playerEvents).map((e) => e.type)).toEqual([
        "dm.seat.changed",
      ]);

      const projections = await loadProjections(b.db, sessionId, {
        role: "dm",
      });
      expect(findProposal(projections, first.proposalId)?.status).toBe(
        "pending",
      );
      expect(findProposal(projections, second.proposalId)?.status).toBe(
        "pending",
      );

      // Approve one over send: its effects and proposal.approved arrive at the DM only.
      const live = collectUntilQuiet(dmWs);
      const playerLive = collectUntilQuiet(playerWs);
      dmWs.send(
        JSON.stringify({
          type: "send",
          sessionId,
          eventType: "proposal.approve",
          payload: { proposalId: first.proposalId },
          payloadVersion: 1,
        }),
      );
      const approved = await live;
      expect(approved.map((e) => e.type)).toEqual([
        "narration",
        "proposal.approved",
      ]);
      expect((await playerLive).map((e) => e.type)).toEqual(["narration"]);

      const after = await loadProjections(b.db, sessionId, { role: "dm" });
      expect(findProposal(after, first.proposalId)?.status).toBe("approved");
      expect(findProposal(after, second.proposalId)?.status).toBe("pending");
    } finally {
      await b.close();
    }
  });
});
