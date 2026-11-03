import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import {
  freeModeAction,
  turnModeCombat,
} from "@the-stacks/session-model/fixtures";
import { changedFields, toLedgerItems } from "../../app/play/ledger-format.ts";

const dm = { role: "dm" };

test("changedFields: scalars", () => {
  assert.deepEqual(changedFields(3, 5), [
    { path: "value", before: "3", after: "5" },
  ]);
  assert.deepEqual(changedFields("a", "a"), []);
});

test("changedFields: nested objects list only changed leaves", () => {
  assert.deepEqual(
    changedFields(
      { hp: { current: 7, temp: 0 }, name: "Goblin" },
      { hp: { current: 2, temp: 0 }, name: "Goblin" },
    ),
    [{ path: "hp.current", before: "7", after: "2" }],
  );
});

test("changedFields: stops at depth 3 and compares the rest as JSON", () => {
  const out = changedFields(
    { a: { b: { c: { d: 1 } } } },
    { a: { b: { c: { d: 2 } } } },
  );
  assert.deepEqual(out, [
    { path: "a.b.c", before: '{"d":1}', after: '{"d":2}' },
  ]);
});

test("changedFields: arrays compare as whole JSON", () => {
  assert.deepEqual(changedFields({ tags: ["a"] }, { tags: ["a", "b"] }), [
    { path: "tags", before: '["a"]', after: '["a","b"]' },
  ]);
  assert.deepEqual(changedFields({ tags: ["a"] }, { tags: ["a"] }), []);
});

test("changedFields: a null before renders none", () => {
  const out = changedFields(null, { hp: { current: 12 }, name: "Ana" });
  assert.deepEqual(out, [
    { path: "hp.current", before: "none", after: "12" },
    { path: "name", before: "none", after: "Ana" },
  ]);
});

test("changedFields: a null after renders none", () => {
  assert.deepEqual(changedFields({ name: "Ana" }, null), [
    { path: "name", before: "Ana", after: "none" },
  ]);
});

test("toLedgerItems: freeModeAction roll, outcome and creations", () => {
  const items = toLedgerItems(project(freeModeAction.events, dm).ledger);
  const roll = items.find((i) => i.kind === "roll");
  assert.equal(roll.reason, "Ana picks the vault lock");
  assert.equal(roll.expression, "1d20+5");
  assert.deepEqual(roll.dice, [{ sides: 20, faces: [13], kept: [true] }]);
  assert.equal(roll.modifier, 5);
  assert.equal(roll.total, 18);
  assert.equal(roll.natural, 13);
  const outcome = items.find((i) => i.kind === "outcome");
  assert.equal(outcome.reason, "Ana picks the vault lock");
  assert.match(outcome.summary, /Success/);
  const added = items.filter(
    (i) => i.kind === "change" && i.type === "combatant.added",
  );
  assert.equal(added.length, 2);
  assert.ok(added[0].fields.length > 0);
  assert.ok(added[0].fields.every((f) => f.before === "none"));
});

test("toLedgerItems: turnModeCombat goblin hp before and after", () => {
  const items = toLedgerItems(project(turnModeCombat.events, dm).ledger);
  const hp = items.find(
    (i) =>
      i.kind === "change" && i.type === "hp.changed" && i.subject === "goblin",
  );
  assert.deepEqual(
    hp.fields.find((f) => f.path === "current"),
    { path: "current", before: "7", after: "2" },
  );
});

test("toLedgerItems: a reaction attack outcome reads 'Reaction: '", () => {
  const ledger = project(turnModeCombat.events, dm).ledger;
  const row = ledger.find(
    (r) => r.kind === "outcome" && r.outcome.type === "attack.resolved",
  );
  assert.ok(row, "fixture has an attack outcome");
  const plain = toLedgerItems([row]).find((i) => i.kind === "outcome");
  assert.doesNotMatch(plain.summary, /^Reaction: /);
  const flagged = {
    ...row,
    outcome: { ...row.outcome, reaction: true },
  };
  const out = toLedgerItems([flagged]).find((i) => i.kind === "outcome");
  assert.match(out.summary, /^Reaction: /);
});

test("toLedgerItems: check outcome labels by band, auto-success and old rows (spec 070)", () => {
  const row = (event) => ({
    kind: "outcome",
    seq: 1,
    actor: "ai:dm",
    visibility: "public",
    reason: "r",
    batchId: "b",
    index: 0,
    actionId: null,
    outcome: {
      type: "check.resolved",
      v: 1,
      reason: "r",
      combatantId: "ana",
      kind: "ability-check",
      ability: "str",
      skill: null,
      rollIndex: 0,
      dc: 12,
      total: 10,
      natural: 10,
      autoFail: null,
      outcome: "success",
      ...event,
    },
  });
  const summary = (event) => toLedgerItems([row(event)])[0].summary;
  assert.equal(
    summary({ band: "success-at-cost" }),
    "Success at a cost (10 vs DC 12)",
  );
  assert.equal(
    summary({ band: "severe-failure", outcome: "failure", total: 6 }),
    "Severe failure (6 vs DC 12)",
  );
  assert.equal(
    summary({ band: "success", total: null, natural: null, rollIndex: null }),
    "Success (no roll)",
  );
  assert.equal(summary({}), "Success (10 vs DC 12)");
  assert.equal(
    summary({ outcome: "failure", total: 8 }),
    "Failure (8 vs DC 12)",
  );
});
