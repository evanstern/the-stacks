import assert from "node:assert/strict";
import { test } from "node:test";
import { dmSeatView } from "../../app/play/dm-seat.ts";

const op = { userId: "u-op", displayName: "Olive" };
const ana = { userId: "u-ana", displayName: "Ana" };
const bram = { userId: "u-bram", displayName: "Bram" };
const party = [
  { name: "Ana", controller: { kind: "player", userId: "u-ana" } },
];
const ai = { gate: { seat: { kind: "ai" } }, party };
const human = (userId) => ({
  gate: { seat: { kind: "human", userId } },
  party,
});

test("AI seat: candidates drop party controllers; self is labelled", () => {
  const v = dmSeatView(ai, [op, ana, bram], "u-op", null);
  assert.deepEqual(v.holder, { kind: "ai" });
  assert.deepEqual(v.candidates, [
    { userId: "u-op", label: "Olive (you)" },
    { userId: "u-bram", label: "Bram" },
  ]);
  assert.equal(v.canReturn, false);
});

test("human seat: holder labelled, dropped from candidates, can return", () => {
  const v = dmSeatView(human("u-op"), [op, ana, bram], "u-op", 2);
  assert.deepEqual(v.holder, { kind: "human", userId: "u-op", label: "Olive" });
  assert.deepEqual(v.candidates, [{ userId: "u-bram", label: "Bram" }]);
  assert.equal(v.canReturn, true);
  assert.equal(v.pendingCount, 2);
});

test("a holder absent from presence is labelled DM", () => {
  const v = dmSeatView(human("u-gone"), [bram], "u-op", null);
  assert.equal(v.holder.label, "DM");
});

test("unknown presence gives null candidates", () => {
  assert.equal(dmSeatView(ai, null, "u-op", null).candidates, null);
});
