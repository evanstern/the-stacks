import { randomUUID } from "node:crypto";
import type { Proposer, StoredEvent } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../src/db.js";
import { readFrom } from "../src/events/log.js";
import { createGate, type GateResult } from "../src/gate/index.js";
import type { PresenceReader } from "../src/presence/index.js";
import { toStoredEvent } from "../src/session/events.js";
import { loadProjections } from "../src/session/projections.js";

/**
 * Group sign-off (specs/044-group-signoff, TASK-0049) through the server gate against a
 * REAL Postgres, with two or three human seats. Every test uses a fresh session id; the
 * events table is append-only and shared.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/gate.signoff.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about group sign-off on a real log.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) throw new Error("sign-off tests require a reachable database");
  return db;
}

const DM_ID = "00000000-0000-4000-8000-0000000000d1";
const ANA_ID = "00000000-0000-4000-8000-0000000000a1";
const CLEO_ID = "00000000-0000-4000-8000-0000000000a2";
const DEV_ID = "00000000-0000-4000-8000-0000000000a3";

const human = (userId: string): Proposer => ({
  kind: "human",
  userId,
  role: "player",
});
const ana = human(ANA_ID);
const cleo = human(CLEO_ID);
const dev = human(DEV_ID);
const operatorDm: Proposer = { kind: "human", userId: DM_ID, role: "operator" };
const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };

const member = (characterId: string, name: string, userId: string) => ({
  kind: "party",
  reason: `${name} joins the party`,
  characterId,
  after: {
    characterId,
    name,
    controller: { kind: "player", userId },
    combatantId: null,
  },
});

function setup(seats: [string, string, string][]) {
  const sessionId = randomUUID();
  const here = { present: seats.map(([, , id]) => id) };
  const presence: PresenceReader = {
    presentUsers: () =>
      here.present.map((userId) => ({ userId, displayName: userId })),
    isPresent: (_sid, actor) =>
      actor.startsWith("ai:") || here.present.includes(actor),
    onChange: () => () => {},
  };
  let n = 0;
  const gate = createGate({
    db: requireDb(),
    presence,
    newId: () => `id-${sessionId.slice(0, 8)}-${++n}`,
  });
  const seen: string[][] = [];
  gate.onAppended((_sid, events) => seen.push(events.map((e) => e.type)));
  const rows = async () =>
    (await readFrom(requireDb(), { sessionId, limit: 500 })).map(toStoredEvent);
  const must = async (r: Promise<GateResult>) => {
    const result = await r;
    if (!result.ok)
      throw new Error(`unexpected refusal ${result.refusal.code}`);
    return result;
  };
  const seatParty = async () => {
    for (const [characterId, name, userId] of seats) {
      await must(
        gate.submit(sessionId, aiDm, member(characterId, name, userId)),
      );
    }
  };
  const declare = (who: Proposer, actionId: string) =>
    must(
      gate.handle(sessionId, who, {
        kind: "action.declare",
        action: {
          actionId,
          characterId: null,
          scope: "party",
          text: "The party crosses the ford together",
        },
      }),
    );
  const comment = (
    who: Proposer,
    actionId: string,
    stance: "comment" | "approve" | "object",
  ) =>
    gate.handle(sessionId, who, {
      kind: "action.comment",
      comment: { actionId, stance, text: `${stance} from table` },
    });
  const commit = (who: Proposer, actionId: string) =>
    gate.handle(sessionId, who, { kind: "action.commit", actionId });
  return {
    sessionId,
    gate,
    here,
    seen,
    rows,
    must,
    seatParty,
    declare,
    comment,
    commit,
  };
}

const kinds = (events: readonly { type: string }[]) =>
  events.map((e) => e.type);

function refusalOf(result: GateResult) {
  if (result.ok) throw new Error("expected a refusal");
  return result.refusal;
}

const TWO: [string, string, string][] = [
  ["ana", "Ana", ANA_ID],
  ["cleo", "Cleo", CLEO_ID],
];

describe.skipIf(!reachable)("gate — group sign-off (two human seats)", () => {
  it("the second player's approval auto-commits with a signoff marker", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.declare(ana, "act-1");
    c.seen.length = 0;

    const result = await c.must(c.comment(cleo, "act-1", "approve"));
    expect(kinds(result.events)).toEqual([
      "action.commented",
      "presence.recorded",
      "action.committed",
    ]);
    const [, marker, committed] = result.events as [
      StoredEvent,
      StoredEvent,
      StoredEvent,
    ];
    expect(marker.actor).toBe("system");
    expect(marker.visibility).toBe("public");
    expect(marker.payload).toEqual({
      present: [ANA_ID, CLEO_ID].sort(),
      purpose: "signoff",
      actionId: "act-1",
    });
    expect(committed.actor).toBe(CLEO_ID);
    expect(committed.payload).toEqual({
      actionId: "act-1",
      authority: "group",
    });
    expect(c.seen).toEqual([
      ["action.commented", "presence.recorded", "action.committed"],
    ]);
    const stored = await c.rows();
    expect(kinds(stored.slice(-3))).toEqual(kinds(result.events));
    const p = await loadProjections(requireDb(), c.sessionId, { role: "dm" });
    expect(p.actions.find((a) => a.actionId === "act-1")?.status).toBe(
      "committed",
    );
  });

  it("an explicit commit before the quorum is met refuses with the waiting list", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.declare(ana, "act-1");
    const before = (await c.rows()).length;
    const refusal = refusalOf(await c.commit(ana, "act-1"));
    expect(refusal.code).toBe("GROUP_SIGNOFF_REQUIRED");
    expect(refusal.details).toEqual({ waiting: [CLEO_ID], objecting: [] });
    expect(await c.rows()).toHaveLength(before);
  });

  it("an objection blocks the commit, names the objector, and a later approval commits", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.declare(ana, "act-1");
    const objected = await c.must(c.comment(cleo, "act-1", "object"));
    expect(kinds(objected.events)).toEqual(["action.commented"]);
    const before = (await c.rows()).length;

    const refusal = refusalOf(await c.commit(ana, "act-1"));
    expect(refusal.code).toBe("GROUP_SIGNOFF_REQUIRED");
    expect(refusal.details).toMatchObject({ objecting: [CLEO_ID] });
    expect(await c.rows()).toHaveLength(before);

    const approved = await c.must(c.comment(cleo, "act-1", "approve"));
    expect(kinds(approved.events)).toEqual([
      "action.commented",
      "presence.recorded",
      "action.committed",
    ]);
  });

  it("an absent third player does not block, and the marker omits them", async () => {
    const c = setup([...TWO, ["dev", "Dev", DEV_ID]]);
    await c.seatParty();
    c.here.present = [ANA_ID, CLEO_ID];
    await c.declare(ana, "act-1");
    const result = await c.must(c.comment(cleo, "act-1", "approve"));
    expect(kinds(result.events)).toEqual([
      "action.commented",
      "presence.recorded",
      "action.committed",
    ]);
    expect(result.events[1]?.payload).toEqual({
      present: [ANA_ID, CLEO_ID].sort(),
      purpose: "signoff",
      actionId: "act-1",
    });
  });

  it("a present third player who has not approved keeps the action open", async () => {
    const c = setup([...TWO, ["dev", "Dev", DEV_ID]]);
    await c.seatParty();
    await c.declare(ana, "act-1");
    const result = await c.must(c.comment(cleo, "act-1", "approve"));
    expect(kinds(result.events)).toEqual(["action.commented"]);
    const done = await c.must(c.comment(dev, "act-1", "approve"));
    expect(kinds(done.events)).toEqual([
      "action.commented",
      "presence.recorded",
      "action.committed",
    ]);
  });

  it("a seated human DM commits over an objection with dm authority and no marker", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "dm.seat",
        reason: "A human takes the DM seat",
        after: { kind: "human", userId: DM_ID },
      }),
    );
    await c.declare(ana, "act-1");
    await c.must(c.comment(cleo, "act-1", "object"));
    const result = await c.must(c.commit(operatorDm, "act-1"));
    expect(kinds(result.events)).toEqual(["action.committed"]);
    expect(result.events[0]?.payload).toEqual({
      actionId: "act-1",
      authority: "dm",
    });
  });

  it("the AI DM commits over an objection with dm authority", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.declare(ana, "act-1");
    await c.must(c.comment(cleo, "act-1", "object"));
    const result = await c.must(c.commit(aiDm, "act-1"));
    expect(kinds(result.events)).toEqual(["action.committed"]);
    expect(result.events[0]?.payload).toMatchObject({ authority: "dm" });
  });

  it("a seated DM withdraws an open party action and a later approval refuses ACTION_NOT_OPEN", async () => {
    const c = setup(TWO);
    await c.seatParty();
    await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "dm.seat",
        reason: "A human takes the DM seat",
        after: { kind: "human", userId: DM_ID },
      }),
    );
    await c.declare(ana, "act-1");
    await c.must(
      c.gate.handle(c.sessionId, operatorDm, {
        kind: "action.withdraw",
        actionId: "act-1",
      }),
    );
    const refusal = refusalOf(await c.comment(cleo, "act-1", "approve"));
    expect(refusal.code).toBe("ACTION_NOT_OPEN");
  });
});
