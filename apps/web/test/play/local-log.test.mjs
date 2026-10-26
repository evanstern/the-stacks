import assert from "node:assert/strict";
import { test } from "node:test";
import { appendLocal } from "../../app/play/local-log.ts";

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
