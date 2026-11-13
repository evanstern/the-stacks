import assert from "node:assert/strict";
import { test } from "node:test";
import { initialFrameState, reduceFrame } from "../../app/play/reduce-frame.ts";

const ev = (seq) => ({
  sessionId: "s",
  seq,
  actor: "a",
  type: "talk",
  payload: {},
  payloadVersion: 1,
  visibility: "public",
  ts: "2026-10-26T18:00:00.000Z",
});

test("event frames append in arrival order and track the highest seq across gaps", () => {
  let s = initialFrameState;
  for (const seq of [2, 5, 3])
    s = reduceFrame(s, { type: "event", event: ev(seq) });
  assert.deepEqual(
    s.events.map((e) => e.seq),
    [2, 5, 3],
  );
  assert.equal(s.highestSeq, 5);
});

test("replay-complete flips caughtUp", () => {
  const s = reduceFrame(initialFrameState, {
    type: "replay-complete",
    throughSeq: 0,
  });
  assert.equal(s.caughtUp, true);
  assert.equal(initialFrameState.caughtUp, false);
});

test("error sets the notice and keeps the events", () => {
  let s = reduceFrame(initialFrameState, { type: "event", event: ev(1) });
  s = reduceFrame(s, {
    type: "error",
    kind: "forbidden",
    message: "Not yours to commit",
  });
  assert.equal(s.notice, "Not yours to commit");
  assert.equal(s.events.length, 1);
});

test("reduceFrame does not mutate the previous state", () => {
  const before = reduceFrame(initialFrameState, {
    type: "event",
    event: ev(1),
  });
  reduceFrame(before, { type: "event", event: ev(2) });
  assert.equal(before.events.length, 1);
});

test("an error frame with a refusal code shows the code in the notice", () => {
  const s = reduceFrame(initialFrameState, {
    type: "error",
    kind: "forbidden",
    message: "Only the seated DM may approve",
    code: "NOT_DM",
  });
  assert.equal(s.notice, "Only the seated DM may approve (NOT_DM)");
});

test("a CONFLICT error frame shows the plain busy-table label", () => {
  const s = reduceFrame(initialFrameState, {
    type: "error",
    kind: "internal",
    message: "the log kept changing; try again",
    code: "CONFLICT",
  });
  assert.equal(
    s.notice,
    "The table was busy, so your line was not sent. Send it again. (CONFLICT)",
  );
});

test("a presence frame replaces the present set and keeps the events", () => {
  let s = reduceFrame(initialFrameState, { type: "event", event: ev(1) });
  assert.equal(s.present, null);
  const a = { userId: "u1", displayName: "Ana" };
  const b = { userId: "u2", displayName: "Ben" };
  s = reduceFrame(s, { type: "presence", sessionId: "s", present: [a, b] });
  assert.deepEqual(s.present, [a, b]);
  s = reduceFrame(s, { type: "presence", sessionId: "s", present: [b] });
  assert.deepEqual(s.present, [b]);
  assert.equal(s.events.length, 1);
});

test("an unknown frame type leaves the state unchanged", () => {
  const s = reduceFrame(initialFrameState, { type: "event", event: ev(1) });
  assert.equal(reduceFrame(s, { type: "from-the-future", x: 1 }), s);
});

test("events keep accumulating after presence and unknown frames", () => {
  let s = reduceFrame(initialFrameState, {
    type: "presence",
    sessionId: "s",
    present: [],
  });
  s = reduceFrame(s, { type: "from-the-future" });
  s = reduceFrame(s, { type: "event", event: ev(4) });
  assert.equal(s.highestSeq, 4);
  assert.deepEqual(s.present, []);
});

const part = (jobId, slot, text) => ({
  type: "narration-stream",
  sessionId: "s",
  jobId,
  slot,
  text,
});

test("narration-stream: parts accumulate per slot, a new job restarts, end clears", () => {
  let s = reduceFrame(initialFrameState, part("j1", "rows", "Check: 15"));
  s = reduceFrame(s, part("j1", "describe", "The shutter gives."));
  s = reduceFrame(s, part("j1", "describe", " Dust falls."));
  assert.deepEqual(s.stream, {
    jobId: "j1",
    rows: "Check: 15",
    restate: "",
    describe: "The shutter gives. Dust falls.",
    ask: "",
  });
  s = reduceFrame(s, part("j2", "rows", "new"));
  assert.equal(s.stream.jobId, "j2");
  assert.equal(s.stream.describe, "");
  // A stale job's end does not clear the live stream.
  assert.notEqual(reduceFrame(s, part("j1", "end", "")).stream, null);
  assert.equal(reduceFrame(s, part("j2", "end", "")).stream, null);
});

test("narration-stream: the settled ai:dm narration event clears it; other events do not", () => {
  let s = reduceFrame(initialFrameState, part("j1", "rows", "r"));
  s = reduceFrame(s, { type: "event", event: { ...ev(1), type: "talk" } });
  assert.notEqual(s.stream, null);
  s = reduceFrame(s, {
    type: "event",
    event: { ...ev(2), type: "narration", actor: "ai:dm" },
  });
  assert.equal(s.stream, null);
});
