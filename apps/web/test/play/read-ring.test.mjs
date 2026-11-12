import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import { oneChatStream } from "@the-stacks/session-model/fixtures";
import { readIndicator } from "../../app/play/read-ring.ts";

const [ana] = oneChatStream.viewers.players;
const dm = oneChatStream.viewers.dm;
const at = (s) => Date.parse(`2026-10-26T18:00:00.000Z`) + s * 1000;
const row = (seq, over = {}) =>
  oneChatStream.events[seq - 1] && {
    ...oneChatStream.events[seq - 1],
    ...over,
  };
// seq 1-2: Ana's say (ts 18:00:01). No read marker yet.
const posts = oneChatStream.events.filter((e) => e.seq <= 2);
const proj = (events, viewer = ana) => project(events, viewer);

test("blank under 2 s, then the ring counts down from the post", () => {
  const p = proj(posts);
  assert.equal(readIndicator(p, ana, at(2)).kind, "hidden");
  const r = readIndicator(p, ana, at(6));
  assert.deepEqual(r, { kind: "ring", remainingS: 5, segments: 5 });
});

test("the remaining time clamps to 8 segments and floors at 0", () => {
  const p = proj(posts);
  const early = readIndicator(p, ana, at(3));
  assert.ok(early.segments <= 8);
  assert.equal(readIndicator(p, ana, at(60)).remainingS, 0);
  // A client clock behind the post: hidden, never more than the window.
  assert.equal(readIndicator(p, ana, at(-100)).kind, "hidden");
});

test("hidden in turn mode, under a human seat and for a DM viewer", () => {
  const turn = {
    ...row(1),
    seq: 3,
    actor: "ai:dm",
    type: "table-mode.changed",
    payload: {
      reason: "Combat",
      before: { mode: "free" },
      after: {
        mode: "turn",
        activeActor: ana.userId,
        activeCharacterId: "ana",
      },
    },
  };
  assert.equal(
    readIndicator(proj([...posts, turn]), ana, at(6)).kind,
    "hidden",
  );
  const seat = {
    ...row(1),
    seq: 3,
    actor: "ai:dm",
    type: "dm.seat.changed",
    payload: {
      reason: "x",
      before: { kind: "ai" },
      after: { kind: "human", userId: "00000000-0000-4000-8000-000000000003" },
    },
  };
  assert.equal(
    readIndicator(proj([...posts, seat]), ana, at(6)).kind,
    "hidden",
  );
  assert.equal(readIndicator(proj(posts, dm), dm, at(6)).kind, "hidden");
});

test("Thinking runs from the read marker until an ai:dm row, a later post or 30 s", () => {
  const marker = {
    ...row(4),
    seq: 3,
  };
  const withMarker = [...posts, marker];
  const p = proj(withMarker);
  assert.equal(readIndicator(p, ana, at(5), marker.ts).kind, "thinking");
  // 30 s after the marker's ts
  assert.equal(
    readIndicator(p, ana, Date.parse(marker.ts) + 30_000, marker.ts).kind,
    "hidden",
  );
  // an ai:dm row ends it
  const dmRow = {
    ...row(12),
    seq: 4,
    actor: "ai:dm",
    type: "narration",
    visibility: "public",
    payload: { text: "The loft creaks.", actionIds: [] },
  };
  assert.equal(
    readIndicator(proj([...withMarker, dmRow]), ana, at(5), marker.ts).kind,
    "hidden",
  );
  // a later readable post ends it (the ring takes over)
  const later = { ...row(1), seq: 4, ts: "2026-10-26T18:00:04.000Z" };
  const laterCarrier = {
    ...row(2),
    seq: 5,
    ts: "2026-10-26T18:00:05.000Z",
    payload: {
      ...row(2).payload,
      intent: { ...row(2).payload.intent, id: "i-9" },
    },
  };
  const after = readIndicator(
    proj([...withMarker, later, laterCarrier]),
    ana,
    at(5),
    marker.ts,
  );
  assert.notEqual(after.kind, "thinking");
});

test("turn mode hides the ring even for an ask_dm post (the mode check, not the post rule)", () => {
  const turn = {
    ...row(1),
    seq: 1,
    actor: "ai:dm",
    type: "table-mode.changed",
    payload: {
      reason: "Combat",
      before: { mode: "free" },
      after: {
        mode: "turn",
        activeActor: ana.userId,
        activeCharacterId: "ana",
      },
    },
  };
  const ask = oneChatStream.events
    .filter((e) => e.seq === 10 || e.seq === 11)
    .map((e, i) => ({
      ...e,
      seq: 2 + i,
      actor: ana.userId,
      visibility: ana.userId,
    }));
  const p = proj([turn, ...ask]);
  assert.equal(readIndicator(p, ana, at(60)).kind, "hidden");
});
