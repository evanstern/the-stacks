import assert from "node:assert/strict";
import { test } from "node:test";
import { presenceRows } from "../../app/play/presence.ts";

const AI = { gate: { seat: { kind: "ai" } } };
const human = (userId) => ({ gate: { seat: { kind: "human", userId } } });
const member = (userId, name) => ({
  name,
  controller: { kind: "player", userId },
});
const ana = { userId: "u-ana", displayName: "Ana" };
const ben = { userId: "u-ben", displayName: "Ben" };
const dmUser = { userId: "u-dm", displayName: "Dana" };

test("an AI seat shows the AI DM present, even with nobody connected", () => {
  assert.deepEqual(presenceRows([], { ...AI, party: [] }), [
    { key: "ai:dm", label: "AI DM", role: "dm", present: true },
  ]);
});

test("a human DM seat shows the holder present as dm", () => {
  const rows = presenceRows([dmUser], { ...human("u-dm"), party: [] });
  assert.deepEqual(rows, [
    { key: "u-dm", label: "Dana", role: "dm", present: true },
  ]);
});

test("a human DM seat whose holder is absent shows absent", () => {
  const rows = presenceRows([ana], {
    ...human("u-dm"),
    party: [member("u-ana", "Ana")],
  });
  assert.deepEqual(
    rows.map((r) => [r.key, r.role, r.present]),
    [
      ["u-ana", "player", true],
      ["u-dm", "dm", false],
    ],
  );
});

test("a present user in the party is a player; any other is an observer", () => {
  const rows = presenceRows([ana, ben], {
    ...AI,
    party: [member("u-ana", "Ana")],
  });
  assert.deepEqual(
    rows.map((r) => [r.key, r.role]),
    [
      ["ai:dm", "dm"],
      ["u-ana", "player"],
      ["u-ben", "observer"],
    ],
  );
});

test("one row per user, however the entries repeat", () => {
  const rows = presenceRows([ana, ana, dmUser], {
    ...human("u-dm"),
    party: [member("u-ana", "Ana"), member("u-ana", "Ana again")],
  });
  assert.equal(rows.length, 2);
});

test("null presence (unknown) yields only the DM row", () => {
  assert.equal(presenceRows(null, { ...AI, party: [] }).length, 1);
  assert.equal(
    presenceRows(null, { ...human("u-dm"), party: [] })[0].present,
    false,
  );
});
