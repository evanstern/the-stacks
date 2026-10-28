import assert from "node:assert/strict";
import { test } from "node:test";
import { currentVersion, project } from "@the-stacks/session-model";
import { dmApprovals, turnFloor } from "@the-stacks/session-model/fixtures";
import {
  appendLocal,
  localFloorEvents,
  localSceneEvents,
} from "../../app/play/local-log.ts";

const base = (seq, ts) => ({
  sessionId: "00000000-0000-4000-8000-000000000102",
  seq,
  actor: "ai:dm",
  type: "talk",
  payload: {},
  payloadVersion: 1,
  visibility: "public",
  ts,
});

test("appendLocal assigns last seq + 1 and last ts + 1 s", () => {
  const events = [
    base(1, "2026-10-26T18:00:01.000Z"),
    base(5, "2026-10-26T18:00:59.000Z"),
  ];
  const out = appendLocal(
    events,
    { eventType: "talk", payload: { text: "hi" }, payloadVersion: 1 },
    "user-1",
  );
  const added = out.at(-1);
  assert.equal(out.length, 3);
  assert.equal(added.seq, 6);
  assert.equal(added.ts, "2026-10-26T18:01:00.000Z");
  assert.equal(added.actor, "user-1");
  assert.equal(added.visibility, "public");
  assert.equal(added.type, "talk");
  assert.equal(added.sessionId, events[0].sessionId);
});

test("appendLocal does not mutate its input", () => {
  const events = Object.freeze([base(1, "2026-10-26T18:00:01.000Z")]);
  const out = appendLocal(
    events,
    { eventType: "talk", payload: {}, payloadVersion: 1 },
    "u",
  );
  assert.equal(events.length, 1);
  assert.notEqual(out, events);
});

test("appendLocal works on an empty log", () => {
  const out = appendLocal(
    [],
    { eventType: "talk", payload: {}, payloadVersion: 1 },
    "u",
  );
  assert.equal(out[0].seq, 1);
});

const upTo = (seq) => turnFloor.events.filter((e) => e.seq <= seq);
const apply = (events, locals, actor) =>
  locals.reduce((acc, l) => appendLocal(acc, l, actor), events);

test("localFloorEvents: take names the seated DM and no character", () => {
  const events = upTo(24);
  const p = project(events, turnFloor.viewers.dm);
  const out = localFloorEvents(p, {
    op: "take",
    turn: { round: 2, combatantId: "ana" },
    reason: "The DM takes the floor.",
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].eventType, "table-mode.changed");
  assert.deepEqual(out[0].payload.before, p.tableMode);
  assert.deepEqual(out[0].payload.after, {
    mode: "turn",
    activeActor: "00000000-0000-4000-8000-000000000003",
    activeCharacterId: null,
  });
});

test("localFloorEvents: return gives the floor back to the engine's active combatant", () => {
  const events = upTo(25);
  const p = project(events, turnFloor.viewers.dm);
  const out = localFloorEvents(p, {
    op: "return",
    turn: { round: 2, combatantId: "ana" },
    reason: "The DM returns the floor.",
  });
  assert.deepEqual(out[0].payload.after, {
    mode: "turn",
    activeActor: "00000000-0000-4000-8000-000000000001",
    activeCharacterId: "ana",
  });
});

test("localFloorEvents: end advances the engine and names the next actor", () => {
  const events = upTo(13);
  const p = project(events, turnFloor.viewers.dm);
  const out = localFloorEvents(p, {
    op: "end",
    turn: { round: 1, combatantId: "ana" },
    reason: "Ends the turn.",
  });
  assert.deepEqual(
    out.map((o) => o.eventType),
    ["turn.advanced", "table-mode.changed"],
  );
  const next = project(apply(events, out, "u"), turnFloor.viewers.dm);
  assert.equal(next.encounter.activeCombatantId, "bram");
  assert.equal(next.tableMode.activeCharacterId, "bram");
  assert.equal(next.diagnostics.skippedInvalid, 0);
});

test("localFloorEvents: end of the last combatant opens the next round", () => {
  const events = upTo(21);
  const p = project(events, turnFloor.viewers.dm);
  const out = localFloorEvents(p, {
    op: "end",
    turn: { round: 1, combatantId: "goblin" },
    reason: "Ends the turn.",
  });
  const next = project(apply(events, out, "u"), turnFloor.viewers.dm);
  assert.equal(next.encounter.round, 2);
  assert.equal(next.encounter.activeCombatantId, "ana");
});

test("localFloorEvents: a stale turn or a free table gives null", () => {
  const p = project(upTo(13), turnFloor.viewers.dm);
  assert.equal(
    localFloorEvents(p, {
      op: "end",
      turn: { round: 1, combatantId: "bram" },
      reason: "x",
    }),
    null,
  );
  const free = project(upTo(12), turnFloor.viewers.dm);
  assert.equal(
    localFloorEvents(free, {
      op: "end",
      turn: { round: 1, combatantId: "ana" },
      reason: "x",
    }),
    null,
  );
});

const dmProjection = () => project(dmApprovals.events, dmApprovals.viewers.dm);
const nextScene = {
  sceneId: "vault-interior",
  title: "Inside the vault",
  summary: "Dust.",
  location: null,
};

test("localSceneEvents builds a scene.changed row with before from the projection", () => {
  const p = dmProjection();
  const row = localSceneEvents(p, {
    reason: "Carry out",
    after: nextScene,
    closeProposalId: null,
  });
  assert.equal(row.eventType, "scene.changed");
  assert.equal(row.payload.before.sceneId, "vault-door");
  assert.deepEqual(row.payload.after, nextScene);
  assert.equal(row.payload.reason, "Carry out");
  assert.equal(row.payloadVersion, currentVersion("scene.changed"));
});

test("localSceneEvents returns null when before and after are both null", () => {
  const p = { ...dmProjection(), scene: null };
  assert.equal(
    localSceneEvents(p, { reason: "r", after: null, closeProposalId: null }),
    null,
  );
});
