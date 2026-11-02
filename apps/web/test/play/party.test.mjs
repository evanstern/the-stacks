import assert from "node:assert/strict";
import { test } from "node:test";
import { partyRows } from "../../app/play/party.ts";

const player = (id, name, userId, extra = {}) => ({
  characterId: id,
  name,
  controller: { kind: "player", userId },
  combatant: null,
  ...extra,
});
const ai = (id, name) => ({
  characterId: id,
  name,
  controller: { kind: "ai-companion", actor: "ai:odo" },
  combatant: null,
});
const viewerA = { role: "player", userId: "u-a" };
const present = [{ userId: "u-b", displayName: "Ben" }];

test("each FR-008 controller label", () => {
  const party = [
    player("a", "A", "u-a"),
    player("b", "B", "u-b"),
    player("c", "C", "u-c"),
    ai("o", "Odo"),
  ];
  const labels = (pr, viewer = viewerA) =>
    partyRows({ party, viewer }, pr).map((r) => r.controller);
  assert.deepEqual(labels(present), [
    "You",
    "Ben",
    "Player (away)",
    "AI companion",
  ]);
  assert.deepEqual(labels(null), ["You", "Player", "Player", "AI companion"]);
});

test("isOwn marks every character a player controls; DM marks none", () => {
  const party = [
    player("a", "A", "u-a"),
    player("a2", "A2", "u-a"),
    ai("o", "O"),
  ];
  assert.deepEqual(
    partyRows({ party, viewer: viewerA }, null).map((r) => r.isOwn),
    [true, true, false],
  );
  assert.deepEqual(
    partyRows({ party, viewer: { role: "dm" } }, null).map((r) => r.isOwn),
    [false, false, false],
  );
  assert.equal(
    partyRows({ party, viewer: { role: "dm" } }, null)[2].isAi,
    true,
  );
});

test("class and level, vitals, and order", () => {
  const hp = { current: 5, max: 9, temp: 2 };
  const party = [
    player("a", "A", "u-a", {
      class: "Cleric",
      level: 1,
      combatant: { hp, ac: 14 },
    }),
    player("b", "B", "u-b", { class: "Cleric" }),
  ];
  const rows = partyRows({ party, viewer: { role: "dm" } }, null);
  assert.deepEqual(
    rows.map((r) => r.characterId),
    ["a", "b"],
  );
  assert.equal(rows[0].classLevel, "Cleric 1");
  assert.deepEqual(rows[0].hp, hp);
  assert.equal(rows[0].ac, 14);
  assert.equal(rows[1].classLevel, null);
  assert.equal(rows[1].hp, null);
  assert.equal(rows[1].ac, null);
});
