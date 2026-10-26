import assert from "node:assert/strict";
import { test } from "node:test";
import { RefIdSchema } from "@the-stacks/session-model";
import {
  approveFrame,
  commentFrame,
  commitFrame,
  declareFrame,
  localEventOf,
  rejectFrame,
  talkFrame,
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

test("commentFrame builds and rejects", () => {
  assert.deepEqual(
    commentFrame({ actionId: "act-1", stance: "object", text: " no " }).payload,
    { comment: { actionId: "act-1", stance: "object", text: "no" } },
  );
  assert.equal(
    commentFrame({ actionId: "act-1", stance: "comment", text: " " }),
    null,
  );
  assert.equal(
    commentFrame({ actionId: "BAD ID", stance: "approve", text: "" }),
    null,
  );
  assert.ok(commentFrame({ actionId: "act-1", stance: "approve", text: "" }));
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

test("no frame carries actor, seq or ts", () => {
  const frames = [
    talkFrame({ text: "x", channel: "ic", characterId: null }),
    declareFrame({ text: "x", characterId: null, scope: "party" }),
    commentFrame({ actionId: "act-1", stance: "approve", text: "" }),
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
  assert.equal(localEventOf(approveFrame("prop-1")), null);
});
