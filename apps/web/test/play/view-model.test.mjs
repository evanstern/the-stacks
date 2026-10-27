import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import {
  fixtureIds,
  fixtures,
  groupSignoff,
  secretTracker,
  talkOnly,
  turnModeCombat,
  unknownAndInvalid,
} from "@the-stacks/session-model/fixtures";
import { toTableViewModel } from "../../app/play/view-model.ts";

const actorOf = (viewer) =>
  viewer.role === "dm" ? fixtureIds.dmActor : viewer.userId;
const vm = (events, viewer, proposals = []) =>
  toTableViewModel(project(events, viewer), {
    actor: actorOf(viewer),
    proposals,
  });
const viewersOf = (f) => [f.viewers.dm, ...f.viewers.players];

test("every fixture maps for every viewer without throwing (SC-001)", () => {
  for (const f of fixtures) {
    for (const viewer of viewersOf(f)) {
      assert.doesNotThrow(() => vm(f.events, viewer), `${f.name}`);
    }
  }
});

test("talkOnly whisper shows only to the recipient", () => {
  const [first, other] = talkOnly.viewers.players;
  const whispers = (v) =>
    vm(talkOnly.events, v).transcript.filter(
      (i) => i.kind === "talk" && i.whisper,
    );
  assert.equal(whispers(first).length, 0);
  assert.equal(whispers(other).length, 1);
});

test("turnModeCombat mode follows each table-mode change", () => {
  const modeIds = turnModeCombat.events
    .filter((e) => e.type === "table-mode.changed")
    .map((e) => e.seq);
  assert.equal(modeIds.length, 3);
  const [ana] = turnModeCombat.viewers.players;
  const through = (seq) => turnModeCombat.events.filter((e) => e.seq <= seq);
  const before = vm(through(modeIds[0] - 1), ana).mode;
  assert.deepEqual(before, { mode: "free" });
  const m1 = vm(through(modeIds[0]), ana).mode;
  assert.deepEqual(m1, {
    mode: "turn",
    activeActor: fixtureIds.playerUserId,
    activeLabel: "Ana",
    isViewersTurn: true,
  });
  const m2 = vm(through(modeIds[1]), ana).mode;
  assert.equal(m2.activeLabel, "Bram");
  assert.equal(m2.isViewersTurn, false);
  assert.deepEqual(vm(through(modeIds[2]), ana).mode, { mode: "free" });
  assert.equal(
    vm(through(modeIds[0]), turnModeCombat.viewers.dm).mode.isViewersTurn,
    false,
  );
});

test("secretTracker leaks nothing to either player (SC-004)", () => {
  for (const viewer of secretTracker.viewers.players) {
    const json = JSON.stringify(vm(secretTracker.events, viewer));
    assert.ok(!json.includes("ritual"), "tracker id");
    assert.ok(!json.includes("Cult scout hides"), "hidden roll reason");
    assert.ok(!json.includes("Cult plans"), "DM journal title");
  }
  const dmLedger = vm(secretTracker.events, secretTracker.viewers.dm).ledger;
  assert.ok(dmLedger.some((i) => i.hidden));
});

test("unknownAndInvalid reports five hidden entries", () => {
  assert.equal(
    vm(unknownAndInvalid.events, unknownAndInvalid.viewers.dm).hiddenCount,
    5,
  );
});

test("proposals reach the DM only", () => {
  const proposal = {
    proposalId: "p1",
    kind: "narration",
    policy: "ask",
    summary: "s",
    proposer: "ai:dm",
    proposerLabel: "DM",
    actionId: null,
    details: [],
    createdSeq: 1,
    ts: "2026-10-26T18:00:00.000Z",
  };
  const f = turnModeCombat;
  assert.deepEqual(
    vm(f.events, f.viewers.players[0], [proposal]).proposals,
    [],
  );
  assert.equal(vm(f.events, f.viewers.dm, [proposal]).proposals.length, 1);
});

test("composer: players with a character may declare; the DM may not", () => {
  const f = turnModeCombat;
  const player = vm(f.events, f.viewers.players[0]).composer;
  assert.equal(player.actionAvailable, true);
  assert.deepEqual(
    player.characters.map((c) => c.characterId),
    ["ana"],
  );
  const dm = vm(f.events, f.viewers.dm).composer;
  assert.equal(dm.actionAvailable, false);
  assert.ok(dm.actionHint);
  assert.equal(
    vm(f.events, f.viewers.players[1]).composer.actionAvailable,
    false,
  );
});

test("action cards carry labels, comments and commit authority", () => {
  const f = fixtures.find((x) => x.name === "free-mode-action");
  const ana = vm(
    f.events.filter((e) => e.seq <= 7),
    f.viewers.players[0],
  );
  const card = ana.transcript.find((i) => i.kind === "action").card;
  assert.equal(card.characterLabel, "Ana");
  assert.equal(card.actorLabel, "You");
  assert.equal(card.comments[0].actorLabel, "Bram");
  assert.deepEqual(card.commit, { canCommit: true, authority: "declarer" });
  const other = vm(
    f.events.filter((e) => e.seq <= 7),
    f.viewers.players[1],
  );
  const otherCard = other.transcript.find((i) => i.kind === "action").card;
  assert.deepEqual(otherCard.commit, { canCommit: false, holderLabel: "Ana" });
  const done = vm(f.events, f.viewers.dm).transcript.find(
    (i) => i.kind === "action",
  ).card;
  assert.equal(done.status, "resolved");
  assert.equal(done.resolved.outcome, "applied");
});

test("a withdrawn action card is closed and offers no withdraw", () => {
  const f = fixtures.find((x) => x.name === "free-mode-action");
  const events = f.events.filter((e) => e.seq <= 7);
  const last = events[events.length - 1];
  const open = vm(events, f.viewers.players[0]).transcript.find(
    (i) => i.kind === "action",
  ).card;
  assert.equal(open.canWithdraw, true);
  const other = vm(events, f.viewers.players[1]).transcript.find(
    (i) => i.kind === "action",
  ).card;
  assert.equal(other.canWithdraw, false);
  const dm = vm(events, f.viewers.dm).transcript.find(
    (i) => i.kind === "action",
  ).card;
  assert.equal(dm.canWithdraw, true);
  const withdrawn = [
    ...events,
    {
      ...last,
      seq: last.seq + 1,
      type: "action.withdrawn",
      version: 1,
      payload: { actionId: open.actionId },
      visibility: "public",
    },
  ];
  const card = vm(withdrawn, f.viewers.players[0]).transcript.find(
    (i) => i.kind === "action",
  ).card;
  assert.equal(card.status, "withdrawn");
  assert.equal(card.open, false);
  assert.equal(card.canWithdraw, false);
});

test("a 1,000-event talk log projects and maps in under 50 ms", () => {
  const events = Array.from({ length: 1000 }, (_, i) => ({
    sessionId: "00000000-0000-4000-8000-000000000999",
    seq: i + 1,
    actor: fixtureIds.playerUserId,
    type: "talk",
    payload: { text: `line ${i}`, channel: "ooc", characterId: null },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-26T18:00:00.000Z",
  }));
  const viewer = { role: "player", userId: fixtureIds.playerUserId };
  vm(events, viewer); // warm up
  // Best of five: a loaded CI box can stall one run; the budget is for the work itself.
  let out;
  let ms = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    out = vm(events, viewer);
    ms = Math.min(ms, performance.now() - t0);
  }
  assert.equal(out.transcript.length, 1000);
  assert.ok(ms < 50, `took ${ms.toFixed(1)} ms`);
});

test("sign-off rows ride open party cards only", () => {
  const [ana, cleo] = groupSignoff.viewers.players;
  const open = groupSignoff.events.filter((e) => e.seq <= 5);
  const card = (events, viewer, present) =>
    toTableViewModel(project(events, viewer), {
      actor: viewer.userId,
      proposals: [],
      present,
    }).transcript.find((i) => i.kind === "action").card;
  const c = card(open, cleo, [ana.userId, cleo.userId]);
  assert.deepEqual(
    c.signoff.map((r) => [r.userId, r.state, r.isViewer]),
    [
      [ana.userId, "approved", false],
      [cleo.userId, "objects", true],
    ],
  );
  const closed = card(groupSignoff.events, cleo, null);
  assert.equal(closed.signoff, null);
});
