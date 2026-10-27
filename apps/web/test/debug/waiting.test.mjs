import assert from "node:assert/strict";
import { test } from "node:test";
import { emptySnapshot } from "../../app/debug/snapshot.ts";
import { toWaitingSummary } from "../../app/debug/waiting.ts";

const T0 = Date.parse("2026-10-27T12:00:00.000Z");
const iso = (offsetMs) => new Date(T0 + offsetMs).toISOString();
const NOW = T0 + 60_000;

const job = (over) => ({
  id: "j",
  kind: "turn",
  status: "queued",
  stage: null,
  attempts: 1,
  input: {},
  result: null,
  error: null,
  createdAt: iso(0),
  startedAt: null,
  heartbeatAt: null,
  finishedAt: null,
  ...over,
});
const ev = (seq, type, offsetMs = 0) => ({
  seq,
  type,
  actor: "u1",
  visibility: "all",
  ts: iso(offsetMs),
});
const proj = (over = {}) => ({
  actions: [],
  party: [],
  tableMode: { mode: "free" },
  encounter: null,
  proposals: [],
  ...over,
});
const snap = (jobs = [], events = []) => ({
  ...emptySnapshot(),
  jobs: new Map(jobs.map((j) => [j.id, j])),
  events,
});
const summary = (jobs, events, p = proj(), now = NOW) =>
  toWaitingSummary(snap(jobs, events), p, now);

test("active jobs carry heartbeat age from now", () => {
  const s = summary([
    job({
      id: "a",
      status: "running",
      stage: "narrate",
      attempts: 2,
      heartbeatAt: iso(55_000),
    }),
    job({ id: "b", status: "queued" }),
    job({ id: "c", status: "succeeded" }),
  ]);
  assert.deepEqual(
    s.active.map((a) => [a.id, a.kind, a.stage, a.attempts, a.heartbeatAgeMs]),
    [
      ["a", "turn", "narrate", 2, 5000],
      ["b", "turn", null, 1, null],
    ],
  );
});

test("declared and discussed actions are listed, committed are not", () => {
  const action = (actionId, status, actor = "u1") => ({
    actionId,
    status,
    actor,
  });
  const s = summary(
    [],
    [],
    proj({
      actions: [
        action("a1", "declared"),
        action("a2", "discussed", "ai:dm"),
        action("a3", "committed"),
        action("a4", "resolved"),
      ],
    }),
  );
  assert.deepEqual(s.uncommitted, [
    { actionId: "a1", actorLabel: "u1", status: "declared" },
    { actionId: "a2", actorLabel: "DM", status: "discussed" },
  ]);
});

test("free and turn mode, with the active actor label", () => {
  assert.deepEqual(summary([], []).mode, { kind: "free" });
  const party = [
    {
      name: "Ana",
      characterId: "c1",
      controller: { kind: "player", userId: "u1" },
    },
  ];
  const s = summary(
    [],
    [],
    proj({
      party,
      tableMode: { mode: "turn", activeActor: "u1", activeCharacterId: "c1" },
      encounter: { round: 3 },
    }),
  );
  assert.deepEqual(s.mode, { kind: "turn", actorLabel: "Ana", round: 3 });
});

test("pending proposals carry policy", () => {
  const s = summary(
    [],
    [],
    proj({
      proposals: [
        { proposalId: "p1", kind: "tracker", policy: "ask", status: "pending" },
        {
          proposalId: "p2",
          kind: "tracker",
          policy: "ask",
          status: "approved",
        },
      ],
    }),
  );
  assert.deepEqual(s.proposals, [
    { proposalId: "p1", kind: "tracker", policy: "ask" },
  ]);
});

test("a held turn pairs with the companion naming it in input.beatJobId", () => {
  const held = job({
    id: "t1",
    status: "succeeded",
    result: { outcome: { status: "held" } },
    finishedAt: iso(1000),
  });
  const comp = job({
    id: "c1",
    kind: "companion",
    status: "running",
    input: { beatJobId: "t1" },
  });
  const other = job({
    id: "c2",
    kind: "companion",
    input: { beatJobId: "zzz" },
  });
  assert.deepEqual(summary([held, comp, other], []).holds, [
    { turnJobId: "t1", companionJobId: "c1", companionStatus: "running" },
  ]);
  assert.deepEqual(summary([held], []).holds, [
    { turnJobId: "t1", companionJobId: null, companionStatus: null },
  ]);
  const done = { ...comp, status: "succeeded" };
  assert.deepEqual(summary([held, done], []).holds, []);
});

const failedTurn = (finishedOffset) =>
  job({
    id: "f1",
    status: "failed",
    error: "boom",
    result: {
      failure: { node: "narrate", kind: "audit", message: "bad prose" },
    },
    finishedAt: iso(finishedOffset),
  });

test("latestFailure is set when the failure is newer than the newest narration", () => {
  const s = summary([failedTurn(20_000)], [ev(1, "narration", 10_000)]);
  assert.deepEqual(s.latestFailure, {
    jobId: "f1",
    node: "narrate",
    kind: "audit",
    message: "bad prose",
    finishedAt: iso(20_000),
  });
  assert.equal(s.showRetry, true);
  // no narration at all counts as later
  assert.ok(summary([failedTurn(20_000)], []).latestFailure);
});

test("latestFailure is unset when a narration came later", () => {
  const s = summary([failedTurn(20_000)], [ev(1, "narration", 30_000)]);
  assert.equal(s.latestFailure, null);
  assert.equal(s.showRetry, false);
});

test("stuck: 15 s after a commit newer than any narration, nothing active", () => {
  const events = [ev(1, "narration", 0), ev(2, "action.committed", 0)];
  const at = (age) => summary([], events, proj(), T0 + age);
  assert.equal(at(15_000).stuck, true);
  assert.equal(at(15_000).showRetry, true);
  assert.equal(at(14_000).stuck, false);
  assert.equal(at(14_000).showRetry, false);
});

test("stuck is false with a running turn or companion, or a later narration", () => {
  const events = [ev(2, "action.committed", 0)];
  const running = job({ id: "r", status: "running" });
  assert.equal(summary([running], events).stuck, false);
  const comp = job({ id: "c", kind: "companion", status: "queued" });
  assert.equal(summary([comp], events).stuck, false);
  assert.equal(
    summary([], [ev(2, "action.committed", 0), ev(3, "narration", 1000)]).stuck,
    false,
  );
});
