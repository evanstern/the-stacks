import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import {
  fixtureIds,
  fixtures,
  groupSignoff,
  secretTracker,
  talkOnly,
  turnFloor,
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
  const { order, ...m1 } = vm(through(modeIds[0]), ana).mode;
  assert.deepEqual(m1, {
    mode: "turn",
    activeActor: fixtureIds.playerUserId,
    activeLabel: "Ana",
    isViewersTurn: true,
    held: false,
  });
  assert.ok(order.length > 0);
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

test("composer: speakers are the viewer's characters then out of character; no party entry", () => {
  const f = turnModeCombat;
  const player = vm(f.events, f.viewers.players[0]).composer;
  assert.deepEqual(
    player.speakers.map((s) => [s.id, s.ooc]),
    [
      ["ana", false],
      [null, true],
    ],
  );
  assert.ok(player.speakers.every((s) => !/party/i.test(s.label)));
  assert.equal(player.canSend, true);
  const dm = vm(f.events, f.viewers.dm).composer;
  assert.equal(dm.dm, true);
  assert.equal(dm.speakers[0].label, "DM");
  const noChar = vm(f.events, f.viewers.players[1]).composer;
  assert.equal(noChar.canSend, false);
  assert.ok(noChar.hint);
  assert.equal(player.mentions[0].token, "@dm");
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

// ---- spec 049: floor passing ----

const ANA = fixtureIds.playerUserId;
const BRAM = fixtureIds.otherPlayerUserId;
const tf = (through, viewer) =>
  vm(
    turnFloor.events.filter((e) => e.seq <= through),
    viewer,
  );
const [tfAna, tfBram] = turnFloor.viewers.players;

test("turn-floor order strip: active, next and you per viewer", () => {
  const ana = tf(13, tfAna).mode;
  assert.equal(ana.held, false);
  assert.deepEqual(
    ana.order.map((o) => [o.combatantId, o.label]),
    [
      ["ana", "Ana"],
      ["bram", "Bram"],
      ["pip", "Pip"],
      ["goblin", "Goblin"],
    ],
  );
  assert.deepEqual(
    ana.order.map((o) => [o.isActive, o.isNext, o.isViewer]),
    [
      [true, false, true],
      [false, true, false],
      [false, false, false],
      [false, false, false],
    ],
  );
  const bram = tf(13, tfBram).mode;
  assert.deepEqual(
    bram.order.map((o) => o.isViewer),
    [false, true, false, false],
  );
  const dm = tf(13, turnFloor.viewers.dm).mode;
  assert.ok(dm.order.every((o) => o.isViewer === false));
});

test("the last combatant's next entry wraps to the first", () => {
  const order = tf(21, tfAna).mode.order;
  const active = order.findIndex((o) => o.isActive);
  assert.equal(order[active].combatantId, "goblin");
  assert.equal(order[0].isNext, true);
});

test("held is true only while the seated DM holds the floor", () => {
  assert.equal(tf(24, turnFloor.viewers.dm).mode.held, false);
  assert.equal(tf(25, turnFloor.viewers.dm).mode.held, true);
  assert.equal(tf(25, tfAna).mode.held, true);
  assert.equal(tf(26, turnFloor.viewers.dm).mode.held, false);
});

test("floor controls per viewer", () => {
  const turn = (combatantId, round = 1) => ({ round, combatantId });
  // Ana's turn, AI seat: Ana ends; Bram and the AI-seat DM have nothing.
  assert.deepEqual(tf(13, tfAna).floor, {
    endTurn: true,
    pass: false,
    take: false,
    return: false,
    turn: turn("ana"),
  });
  assert.deepEqual(tf(13, tfBram).floor, {
    endTurn: false,
    pass: false,
    take: false,
    return: false,
    turn: turn("ana"),
  });
  assert.equal(tf(13, turnFloor.viewers.dm).floor.pass, false);
  // Round 2, human DM seated, floor not held: Pass and Take floor.
  assert.deepEqual(tf(24, turnFloor.viewers.dm).floor, {
    endTurn: false,
    pass: true,
    take: true,
    return: false,
    turn: turn("ana", 2),
  });
  // Floor held: Pass and Return floor; Ana's End turn is gone.
  assert.deepEqual(tf(25, turnFloor.viewers.dm).floor, {
    endTurn: false,
    pass: true,
    take: false,
    return: true,
    turn: turn("ana", 2),
  });
  assert.equal(tf(25, tfAna).floor.endTurn, false);
});

test("no floor controls in free mode or without an encounter", () => {
  const free = vm(talkOnly.events, talkOnly.viewers.players[0]).floor;
  assert.deepEqual(free, {
    endTurn: false,
    pass: false,
    take: false,
    return: false,
    turn: null,
  });
});

test("floor transcript lines: Your turn, a name, the DM floor; none for free mode", () => {
  const lines = (through, viewer) =>
    tf(through, viewer)
      .transcript.filter((i) => i.kind === "floor")
      .map((i) => i.text);
  assert.deepEqual(lines(15, tfAna), ["Your turn", "Bram's turn"]);
  assert.deepEqual(lines(15, tfBram), ["Ana's turn", "Your turn"]);
  assert.equal(lines(25, tfAna).at(-1), "The DM has the floor");
  assert.equal(lines(26, tfAna).at(-1), "Your turn");
  const seqs = tf(26, tfAna).transcript.map((i) => i.seq);
  assert.deepEqual(
    seqs,
    [...seqs].sort((a, b) => a - b),
  );
  const free = vm(talkOnly.events, talkOnly.viewers.players[0]).transcript;
  assert.ok(free.every((i) => i.kind !== "floor"));
  const combat = vm(
    turnModeCombat.events,
    turnModeCombat.viewers.players[0],
  ).transcript.filter((i) => i.kind === "floor");
  assert.equal(combat.length, 2, "the free-mode change adds no line");
});

test("no player Commit in turn mode; the DM keeps it (FR-023)", () => {
  const events = turnFloor.events.filter((e) => e.seq <= 13);
  const declare = (actor, actionId, characterId) => ({
    sessionId: events[0].sessionId,
    seq: events.length + 1,
    actor,
    type: "action.declared",
    payload: {
      actionId,
      characterId,
      scope: "character",
      text: "Ana charges.",
    },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-27T12:00:00.000Z",
  });
  const log = [...events, declare(ANA, "act-a", "ana")];
  const cardFor = (viewer) =>
    vm(log, viewer).transcript.find((i) => i.kind === "action").card;
  assert.equal(cardFor(tfAna).commit.canCommit, false);
  assert.equal(cardFor(tfBram).commit.canCommit, false);
  assert.deepEqual(cardFor(turnFloor.viewers.dm).commit, {
    canCommit: true,
    authority: "dm",
  });
  assert.equal(vm(log, tfAna).composer.active, true);
  assert.equal(vm(log, tfBram).composer.active, false);
  assert.equal(vm(log, tfAna).composer.mode, "turn");
});

// ---- spec 105: the confirm row ----

import { oneChatStream } from "@the-stacks/session-model/fixtures";

const [ocsAna, ocsBram] = oneChatStream.viewers.players;
// The fixture carries no party rows: two prepended rows make Ana and Bram human-controlled.
const partyRow = (seq, id, name, userId) => ({
  ...oneChatStream.events[0],
  seq,
  actor: "ai:dm",
  type: "party.member.changed",
  payload: {
    reason: `${name} joins`,
    characterId: id,
    before: null,
    after: {
      characterId: id,
      name,
      controller: { kind: "player", userId },
      combatantId: id,
    },
  },
});
const ocs = (through, viewer) =>
  vm(
    [
      partyRow(1, "ana", "Ana", ANA),
      partyRow(2, "bram", "Bram", BRAM),
      ...oneChatStream.events
        .filter((e) => e.seq <= through)
        .map((e) => ({ ...e, seq: e.seq + 2 })),
    ],
    viewer,
  );
const confirms = (m) => m.transcript.filter((i) => i.kind === "confirm");

test("confirm row: the item's controller can accept; others wait on her", () => {
  const forAna = confirms(ocs(5, ocsAna))[0].confirm.lines[0];
  assert.equal(forAna.state, "live");
  assert.equal(forAna.canAccept, true);
  assert.equal(forAna.waitingOn, null);
  assert.equal(forAna.kindLabel, "Hide");
  const forBram = confirms(ocs(5, ocsBram))[0].confirm.lines[0];
  assert.equal(forBram.canAccept, false);
  assert.equal(forBram.waitingOn, "Ana");
});

test("confirm row: a later confirm supersedes, and a party item waits on the party", () => {
  const m = ocs(8, ocsBram);
  const [first, second] = confirms(m);
  assert.equal(first.confirm.lines[0].state, "stale");
  assert.equal(first.confirm.lines[0].waitingOn, null);
  assert.equal(second.confirm.lines[0].state, "live");
  assert.equal(second.confirm.lines[0].canAccept, true);
  const dm = confirms(ocs(8, oneChatStream.viewers.dm))[1].confirm.lines[0];
  assert.equal(dm.canAccept, false);
  assert.equal(dm.waitingOn, "the party");
});

test("confirm row: an intent.recorded row reads Confirmed", () => {
  const line = confirms(ocs(9, ocsAna))[1].confirm.lines[0];
  assert.equal(line.state, "confirmed");
  assert.equal(line.waitingOn, null);
});

test("the DM aside and the ask_dm line are separate items", () => {
  const m = ocs(13, ocsBram);
  assert.ok(m.transcript.some((i) => i.kind === "aside"));
  const ask = m.transcript.find((i) => i.kind === "talk" && i.askDm);
  assert.ok(ask);
  assert.ok(
    !m.transcript.some((i) => i.kind === "talk" && i.actorLabel === "DM"),
  );
});

test("a human DM sees Confirm as action on a say and Confirm on a declared Intent", () => {
  const seat = {
    ...oneChatStream.events[0],
    seq: 1,
    actor: fixtureIds.dmUserId,
    type: "dm.seat.changed",
    payload: {
      reason: "A human takes the DM seat",
      before: { kind: "ai" },
      after: { kind: "human", userId: fixtureIds.dmUserId },
    },
  };
  const log = [
    seat,
    ...oneChatStream.events
      .filter((e) => e.seq <= 5)
      .map((e) => ({ ...e, seq: e.seq + 1 })),
  ];
  const m = vm(log, oneChatStream.viewers.dm);
  assert.equal(m.transcript.find((i) => i.kind === "talk").confirmable, true);
  const hide = m.transcript.find((i) => i.kind === "intent");
  assert.equal(hide.declaredIntent.kind, "hide");
  // A player never sees either control.
  const p = vm(log, ocsAna);
  assert.equal(p.transcript.find((i) => i.kind === "talk").confirmable, false);
  assert.equal(
    p.transcript.find((i) => i.kind === "intent").declaredIntent,
    null,
  );
});

test("sceneChange: a DM viewer sees P3 pending; a player viewer gets null", async () => {
  const { dmApprovals } = await import("@the-stacks/session-model/fixtures");
  const { selectPendingProposals } = await import(
    "../../app/play/proposals.ts"
  );
  const dmViewer = dmApprovals.viewers.dm;
  const proposals = selectPendingProposals(dmApprovals.events, dmViewer);
  const dm = vm(dmApprovals.events, dmViewer, proposals);
  assert.notEqual(dm.sceneChange, null);
  assert.deepEqual(
    dm.sceneChange.pending.map((s) => s.proposalId),
    ["prop-3"],
  );
  for (const player of dmApprovals.viewers.players) {
    assert.equal(vm(dmApprovals.events, player, proposals).sceneChange, null);
  }
});

test("tableMode: a DM viewer gets the view; a player viewer gets null", () => {
  const dmViewer = turnModeCombat.viewers.dm;
  assert.notEqual(vm(turnModeCombat.events, dmViewer).tableMode, null);
  for (const player of turnModeCombat.viewers.players) {
    assert.equal(vm(turnModeCombat.events, player).tableMode, null);
  }
});

test("an absence pass reads as an absence, not a skipped turn (spec 071)", () => {
  const reason = "The AI DM passes the turn of an absent player.";
  const events = turnFloor.events.map((e) =>
    e.type === "table-mode.changed" &&
    e.payload.reason === "Ana is away; the DM passes her turn."
      ? { ...e, payload: { ...e.payload, reason } }
      : e,
  );
  const seq = events.find((e) => e.payload.reason === reason).seq;
  const line = (viewer) =>
    vm(events, viewer).transcript.find(
      (t) => t.kind === "floor" && t.seq === seq,
    ).text;
  assert.equal(
    line(turnFloor.viewers.dm),
    "Ana is away; the turn passes to Bram.",
  );
  assert.equal(line(tfAna), "Ana is away; the turn passes to Bram.");
  assert.equal(line(tfBram), "Ana is away; your turn.");
  // A normal advance keeps its line.
  const normal = turnFloor.events.find(
    (e) => e.type === "table-mode.changed" && e.seq < seq,
  );
  assert.match(
    vm(turnFloor.events, turnFloor.viewers.dm).transcript.find(
      (t) => t.kind === "floor" && t.seq === normal.seq,
    ).text,
    /turn$|floor$/,
  );
});
