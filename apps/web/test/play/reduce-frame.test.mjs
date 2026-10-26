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
