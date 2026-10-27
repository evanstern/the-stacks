import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../src/db.js";
import { readFrom, SeqConflictError } from "../src/events/log.js";
import { createGate } from "../src/gate/index.js";
import type { PresenceReader } from "../src/presence/index.js";
import { appendSessionEvents, toStoredEvent } from "../src/session/events.js";
import { loadProjections } from "../src/session/projections.js";

/**
 * Gate.recordPresence (specs/035-presence T017, T023; decision-0024) against a REAL Postgres.
 * Every test uses a fresh session id; the events table is append-only and shared.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/gate.presence.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about presence markers on a real log.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) throw new Error("presence gate tests require a reachable database");
  return db;
}

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";

function readerOf(userIds: string[]): PresenceReader {
  return {
    presentUsers: () =>
      userIds.map((userId) => ({ userId, displayName: userId })),
    isPresent: (_sid, actor) =>
      actor.startsWith("ai:") || userIds.includes(actor),
    onChange: () => () => {},
  };
}

async function rowsOf(sessionId: string) {
  return (await readFrom(requireDb(), { sessionId, limit: 100 })).map(
    toStoredEvent,
  );
}

describe.skipIf(!reachable)("gate.recordPresence", () => {
  it("appends one public system marker with a sorted payload", async () => {
    const sessionId = randomUUID();
    // The reader returns B before A; the marker must be sorted ascending.
    const gate = createGate({ db: requireDb(), presence: readerOf([B, A]) });
    const result = await gate.recordPresence(sessionId, {
      purpose: "director",
    });
    expect(result.ok).toBe(true);
    const rows = await rowsOf(sessionId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "presence.recorded",
      payloadVersion: 1,
      actor: "system",
      visibility: "public",
      payload: { present: [A, B], purpose: "director" },
    });
    if (result.ok) expect(result.event.seq).toBe(rows[0]?.seq);
  });

  it("carries the action id when given", async () => {
    const sessionId = randomUUID();
    const gate = createGate({ db: requireDb(), presence: readerOf([A]) });
    await gate.recordPresence(sessionId, {
      purpose: "signoff",
      actionId: "act-1",
    });
    const rows = await rowsOf(sessionId);
    expect(rows[0]?.payload).toEqual({
      present: [A],
      purpose: "signoff",
      actionId: "act-1",
    });
  });

  it("appends one row per call even when the set is unchanged", async () => {
    const sessionId = randomUUID();
    const gate = createGate({ db: requireDb(), presence: readerOf([A]) });
    await gate.recordPresence(sessionId, { purpose: "director" });
    await gate.recordPresence(sessionId, { purpose: "director" });
    const rows = await rowsOf(sessionId);
    expect(rows.map((r) => r.type)).toEqual([
      "presence.recorded",
      "presence.recorded",
    ]);
    const p = await loadProjections(requireDb(), sessionId, { role: "dm" });
    expect(p.presence?.seq).toBe(rows[1]?.seq);
    expect(p.presence?.present).toEqual([A]);
  });

  it("retries on a seq conflict and then succeeds", async () => {
    const sessionId = randomUUID();
    let thrown = 0;
    const gate = createGate({
      db: requireDb(),
      presence: readerOf([A]),
      appendSessionEvents: async (d, inputs, options) => {
        if (thrown < 2) {
          thrown++;
          throw new SeqConflictError(options?.expectedLastSeq ?? 0, -1);
        }
        return appendSessionEvents(d, inputs, options);
      },
    });
    const result = await gate.recordPresence(sessionId, {
      purpose: "director",
    });
    expect(result.ok).toBe(true);
    expect(thrown).toBe(2);
    expect(await rowsOf(sessionId)).toHaveLength(1);
  });

  it("refuses with CONFLICT after three conflicts", async () => {
    const sessionId = randomUUID();
    const gate = createGate({
      db: requireDb(),
      appendSessionEvents: async (_d, _i, options) => {
        throw new SeqConflictError(options?.expectedLastSeq ?? 0, -1);
      },
    });
    const result = await gate.recordPresence(sessionId, {
      purpose: "director",
    });
    expect(result).toMatchObject({ ok: false, refusal: { code: "CONFLICT" } });
    expect(await rowsOf(sessionId)).toHaveLength(0);
  });

  it("notifies onAppended listeners with the stored row", async () => {
    const sessionId = randomUUID();
    const gate = createGate({ db: requireDb(), presence: readerOf([A]) });
    const seen: { sessionId: string; types: string[] }[] = [];
    gate.onAppended((sid, events) =>
      seen.push({ sessionId: sid, types: events.map((e) => e.type) }),
    );
    await gate.recordPresence(sessionId, { purpose: "director" });
    expect(seen).toEqual([{ sessionId, types: ["presence.recorded"] }]);
  });

  it("records an empty set when no human is present", async () => {
    const sessionId = randomUUID();
    const gate = createGate({ db: requireDb() });
    await gate.recordPresence(sessionId, { purpose: "director" });
    const rows = await rowsOf(sessionId);
    expect(rows[0]?.payload).toEqual({ present: [], purpose: "director" });
  });
});
