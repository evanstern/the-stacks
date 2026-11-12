import assert from "node:assert/strict";
import { test } from "node:test";
import { GATE_REQUEST_VERSION, RefIdSchema } from "@the-stacks/session-model";
import {
  approveFrame,
  acceptFrame,
  commitFrame,
  declareFrame,
  dmSeatFrame,
  dmSeatReason,
  encounterEndFrame,
  floorFrame,
  localEventOf,
  rejectFrame,
  intentFrame,
  sceneFrame,
  sceneSummary,
  suggestFrame,
  tableModeFrame,
  tableModeReason,
  talkFrame,
  withdrawFrame,
} from "../../app/play/frames.ts";

test("talkFrame builds the talk frame and trims text", () => {
  assert.deepEqual(
    talkFrame({ text: "  hello  ", channel: "ic", characterId: "ana" }),
    {
      eventType: "talk",
      payloadVersion: 1,
      payload: { talk: { text: "hello", channel: "ic", characterId: "ana" } },
    },
  );
});

test("talkFrame returns null for empty text", () => {
  assert.equal(
    talkFrame({ text: "   ", channel: "ooc", characterId: null }),
    null,
  );
});

test("declareFrame mints an act- UUID id that parses as a RefId", () => {
  const frame = declareFrame({
    text: " Ana picks the lock. ",
    characterId: "ana",
    scope: "character",
  });
  assert.equal(frame.eventType, "action.declare");
  assert.equal(frame.payload.action.actionId.slice(0, 4), "act-");
  assert.match(
    frame.payload.action.actionId,
    /^act-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  assert.ok(RefIdSchema.safeParse(frame.payload.action.actionId).success);
  assert.equal(frame.payload.action.text, "Ana picks the lock.");
});

test("declareFrame rejects empty text and a character scope with no character", () => {
  assert.equal(
    declareFrame({ text: "", characterId: "ana", scope: "character" }),
    null,
  );
  assert.equal(
    declareFrame({ text: "x", characterId: null, scope: "character" }),
    null,
  );
  assert.ok(declareFrame({ text: "x", characterId: null, scope: "party" }));
});

const SAY = {
  id: "int-1",
  kind: "say",
  actor: { kind: "pc", id: "ana" },
  text: "hello",
  source: "composer",
  commit: "declared",
};

test("intentFrame wraps a valid Intent and rejects an invalid one", () => {
  const frame = intentFrame(SAY);
  assert.equal(frame.eventType, "intent");
  assert.equal(frame.payload.intent.kind, "say");
  assert.equal(frame.payload.intent.text, "hello");
  assert.equal(intentFrame({ ...SAY, kind: "nope" }), null);
  assert.equal(intentFrame({ ...SAY, text: undefined }), null);
});

test("acceptFrame builds action.accept and rejects a bad item id", () => {
  assert.deepEqual(acceptFrame({ suggestionId: "sug-1", itemId: "i1" }), {
    eventType: "action.accept",
    payloadVersion: 1,
    payload: { suggestionId: "sug-1", itemId: "i1" },
  });
  assert.equal(acceptFrame({ suggestionId: "sug-1", itemId: "x" }), null);
  assert.equal(acceptFrame({ suggestionId: "", itemId: "i1" }), null);
});

test("suggestFrame mints a sug- id and validates the items", () => {
  const item = {
    itemId: "i1",
    text: "Climb",
    intent: { ...SAY, id: "sug-1.i1", kind: "attempt", text: "climb" },
  };
  const frame = suggestFrame({ readSeq: 4, items: [item] }, "sug-1");
  assert.equal(frame.eventType, "action.suggest");
  assert.equal(frame.payload.suggestion.suggestionId, "sug-1");
  assert.equal(frame.payload.suggestion.readSeq, 4);
  assert.match(
    suggestFrame({ readSeq: 0, items: [item] }).payload.suggestion.suggestionId,
    /^sug-/,
  );
  assert.equal(suggestFrame({ readSeq: 4, items: [] }, "sug-1"), null);
  const confirmed = {
    ...item,
    intent: { ...item.intent, commit: "confirmed" },
  };
  assert.equal(suggestFrame({ readSeq: 4, items: [confirmed] }, "sug-1"), null);
});

test("commitFrame builds the action.commit request and rejects a bad id", () => {
  // The gate derives the authority; the frame never carries one.
  assert.deepEqual(commitFrame({ actionId: "act-1", authority: "dm" }), {
    eventType: "action.commit",
    payloadVersion: 1,
    payload: { actionId: "act-1" },
  });
  assert.equal(commitFrame({ actionId: "", authority: "dm" }), null);
});

test("withdrawFrame builds the action.withdraw request and rejects a bad id", () => {
  assert.deepEqual(withdrawFrame({ actionId: "act-1" }), {
    eventType: "action.withdraw",
    payloadVersion: 1,
    payload: { actionId: "act-1" },
  });
  assert.equal(withdrawFrame({ actionId: "" }), null);
});

test("no frame carries actor, seq or ts", () => {
  const frames = [
    talkFrame({ text: "x", channel: "ic", characterId: null }),
    declareFrame({ text: "x", characterId: null, scope: "party" }),
    intentFrame(SAY),
    commitFrame({ actionId: "act-1", authority: "dm" }),
  ];
  for (const f of frames) {
    for (const key of ["actor", "seq", "ts"]) {
      assert.ok(!(key in f), `frame has top-level ${key}`);
      assert.ok(!(key in f.payload), `payload has ${key}`);
    }
  }
});

test("approve and reject frames name the gate request kinds", () => {
  assert.deepEqual(approveFrame("prop-1"), {
    eventType: "proposal.approve",
    payloadVersion: 1,
    payload: { proposalId: "prop-1" },
  });
  assert.deepEqual(rejectFrame("prop-1", "  too risky "), {
    eventType: "proposal.reject",
    payloadVersion: 1,
    payload: { proposalId: "prop-1", reason: "too risky" },
  });
  assert.equal(rejectFrame("prop-1", "   ").payload.reason, null);
  assert.equal(rejectFrame("prop-1", null).payload.reason, null);
  assert.equal(approveFrame(""), null);
});

test("localEventOf maps request frames back to catalog events for fixture mode", () => {
  const talk = localEventOf(
    talkFrame({ text: "hi", channel: "ooc", characterId: null }),
  );
  assert.equal(talk.eventType, "talk");
  assert.deepEqual(talk.payload, {
    text: "hi",
    channel: "ooc",
    characterId: null,
  });
  const decl = localEventOf(
    declareFrame({ text: "x", characterId: null, scope: "party" }),
  );
  assert.equal(decl.eventType, "action.declared");
  const commit = localEventOf(
    commitFrame({ actionId: "act-1", authority: "dm" }),
    "dm",
  );
  assert.deepEqual(commit.payload, { actionId: "act-1", authority: "dm" });
  assert.equal(commit.eventType, "action.committed");
  const withdrawn = localEventOf(withdrawFrame({ actionId: "act-1" }));
  assert.equal(withdrawn.eventType, "action.withdrawn");
  assert.deepEqual(withdrawn.payload, { actionId: "act-1" });
  assert.equal(localEventOf(approveFrame("prop-1")), null);
});

test("floorFrame builds the floor request with the current turn", () => {
  const turn = { round: 2, combatantId: "ana" };
  assert.deepEqual(floorFrame({ op: "end", turn }), {
    eventType: "floor",
    payloadVersion: 1,
    payload: { op: "end", turn, reason: "Ends the turn." },
  });
  assert.equal(
    floorFrame({ op: "take", turn }).payload.reason,
    "The DM takes the floor.",
  );
  assert.equal(
    floorFrame({ op: "return", turn }).payload.reason,
    "The DM returns the floor.",
  );
  assert.equal(
    floorFrame({ op: "end", turn, reason: "  Bram is done.  " }).payload.reason,
    "Bram is done.",
  );
});

test("floorFrame returns null for a bad op or a missing turn", () => {
  const turn = { round: 1, combatantId: "ana" };
  assert.equal(floorFrame({ op: "skip", turn }), null);
  assert.equal(floorFrame({ op: "end", turn: null }), null);
  assert.equal(
    floorFrame({ op: "end", turn: { round: 0, combatantId: "ana" } }),
    null,
  );
  assert.equal(
    floorFrame({ op: "end", turn: { round: 1, combatantId: "" } }),
    null,
  );
});

test("localEventOf leaves a floor request to the fixture projection", () => {
  const frame = floorFrame({
    op: "take",
    turn: { round: 1, combatantId: "ana" },
  });
  assert.equal(localEventOf(frame), null);
});

const sceneAfter = {
  sceneId: "vault-interior",
  title: "  Inside the vault ",
  summary: " Dust and silence. ",
  location: "   ",
};

test("sceneFrame builds a scene gate request with trimmed fields", () => {
  assert.deepEqual(
    sceneFrame({
      reason: "  Carry out the suggestion ",
      after: sceneAfter,
      closeProposalId: "p-3",
    }),
    {
      eventType: "scene",
      payloadVersion: GATE_REQUEST_VERSION,
      payload: {
        reason: "Carry out the suggestion",
        after: {
          sceneId: "vault-interior",
          title: "Inside the vault",
          summary: "Dust and silence.",
          location: null,
        },
        summary: "Scene: Inside the vault",
        rationale: null,
      },
    },
  );
});

test("sceneFrame with after null builds the clear summary", () => {
  const frame = sceneFrame({
    reason: "Done",
    after: null,
    closeProposalId: null,
  });
  assert.equal(frame.payload.summary, "Clear the scene");
  assert.equal(frame.payload.after, null);
  assert.equal(sceneSummary(null), "Clear the scene");
});

test("sceneFrame never carries closeProposalId", () => {
  const frame = sceneFrame({
    reason: "r",
    after: sceneAfter,
    closeProposalId: "p-3",
  });
  assert.equal("closeProposalId" in frame.payload, false);
});

test("sceneFrame returns null for a long title, empty reason or bad sceneId", () => {
  const ok = { ...sceneAfter, title: "T" };
  assert.equal(
    sceneFrame({
      reason: "r",
      after: { ...ok, title: "x".repeat(201) },
      closeProposalId: null,
    }),
    null,
  );
  assert.equal(
    sceneFrame({ reason: "  ", after: ok, closeProposalId: null }),
    null,
  );
  assert.equal(
    sceneFrame({
      reason: "r",
      after: { ...ok, sceneId: "bad id!" },
      closeProposalId: null,
    }),
    null,
  );
});

test("localEventOf returns null for a scene frame", () => {
  const frame = sceneFrame({
    reason: "r",
    after: sceneAfter,
    closeProposalId: null,
  });
  assert.equal(localEventOf(frame), null);
});

test("encounterEndFrame builds the mechanics request", () => {
  assert.deepEqual(
    encounterEndFrame({ reason: "  The goblin flees.  ", thenFree: true }),
    {
      eventType: "mechanics",
      payloadVersion: GATE_REQUEST_VERSION,
      payload: {
        command: { type: "encounter.end", reason: "The goblin flees." },
        actionId: null,
        visibility: "public",
        summary: "End the encounter",
        rationale: null,
      },
    },
  );
});

test("encounterEndFrame uses the default reason when blank", () => {
  const frame = encounterEndFrame({ reason: "   ", thenFree: false });
  assert.equal(frame.payload.command.reason, tableModeReason("end"));
  assert.equal(tableModeReason("end"), "The DM ends the encounter.");
  assert.equal(tableModeReason("free"), "The DM switches to free mode.");
  assert.equal(tableModeReason("turn"), "The DM switches to turn mode.");
});

test("encounterEndFrame returns null for a 501-character reason", () => {
  assert.equal(
    encounterEndFrame({ reason: "x".repeat(501), thenFree: false }),
    null,
  );
});

test("tableModeFrame builds a free-mode request", () => {
  assert.deepEqual(
    tableModeFrame({ reason: " Back to free. ", after: { mode: "free" } }),
    {
      eventType: "table-mode",
      payloadVersion: GATE_REQUEST_VERSION,
      payload: {
        reason: "Back to free.",
        after: { mode: "free" },
        summary: "Table mode: free",
        rationale: null,
      },
    },
  );
});

test("tableModeFrame accepts a turn after and refuses a bad one", () => {
  const turn = {
    mode: "turn",
    activeActor: "00000000-0000-4000-8000-000000000001",
    activeCharacterId: "ana",
  };
  const frame = tableModeFrame({ reason: "Roll initiative.", after: turn });
  assert.equal(frame.payload.summary, "Table mode: turn");
  assert.deepEqual(frame.payload.after, turn);
  assert.equal(tableModeFrame({ reason: "x", after: { mode: "turn" } }), null);
  assert.equal(tableModeFrame({ reason: "x", after: { mode: "bogus" } }), null);
  assert.equal(
    tableModeFrame({ reason: "x".repeat(501), after: { mode: "free" } }),
    null,
  );
});

const UID = "123e4567-e89b-42d3-a456-426614174000";

test("dmSeatFrame builds a dm.seat request for a human and for the AI", () => {
  assert.deepEqual(
    dmSeatFrame({
      reason: "  Ben runs it.  ",
      after: { kind: "human", userId: UID },
    }),
    {
      eventType: "dm.seat",
      payloadVersion: GATE_REQUEST_VERSION,
      payload: {
        reason: "Ben runs it.",
        after: { kind: "human", userId: UID },
      },
    },
  );
  assert.equal(
    dmSeatFrame({ reason: "back", after: { kind: "ai" } }).payload.after.kind,
    "ai",
  );
});

test("dmSeatFrame returns null for a bad reason or seat", () => {
  const ok = { kind: "human", userId: UID };
  assert.equal(dmSeatFrame({ reason: "   ", after: ok }), null);
  assert.equal(dmSeatFrame({ reason: "x".repeat(501), after: ok }), null);
  assert.equal(
    dmSeatFrame({ reason: "r", after: { kind: "human", userId: "nope" } }),
    null,
  );
  assert.equal(dmSeatFrame({ reason: "r", after: { kind: "robot" } }), null);
});

test("dmSeatReason names the default reasons", () => {
  assert.equal(dmSeatReason("seat"), "The operator seats a human DM.");
  assert.equal(
    dmSeatReason("return"),
    "The operator returns the seat to the AI DM.",
  );
});
