import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dmApprovals,
  turnModeCombat,
} from "@the-stacks/session-model/fixtures";
import {
  planEncounterEnd,
  planScene,
  planTableMode,
  proposalsFor,
  viewerForKey,
} from "../../app/play/use-fixture-table.ts";

const dm = dmApprovals.viewers.dm;
const events = dmApprovals.events;

test("the DM sees the pending proposals the events carry", () => {
  assert.equal(proposalsFor(events, dm, new Set()).length, 3);
});

test("approve and reject remove the proposal from the list", () => {
  const all = proposalsFor(events, dm, new Set());
  const id = all[0].proposalId;
  const after = proposalsFor(events, dm, new Set([id]));
  assert.equal(after.length, all.length - 1);
  assert.ok(after.every((p) => p.proposalId !== id));
});

test("a player viewer receives no proposals", () => {
  const player = viewerForKey(
    dmApprovals,
    dmApprovals.viewers.players[0].userId,
  );
  assert.equal(player.role, "player");
  assert.deepEqual(proposalsFor(events, player, new Set()), []);
});

const seed = {
  sceneId: "vault-interior",
  title: "Inside the vault",
  summary: "Dust.",
  location: null,
};

test("planScene yields one scene.changed row and the proposal to close", () => {
  const plan = planScene(events, dm, {
    reason: "Carry out",
    after: seed,
    closeProposalId: "p-3",
  });
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].eventType, "scene.changed");
  assert.equal(plan.rows[0].payload.before.sceneId, "vault-door");
  assert.equal(plan.close, "p-3");
});

test("planScene with no closeProposalId closes nothing", () => {
  const plan = planScene(events, dm, {
    reason: "Edit",
    after: seed,
    closeProposalId: null,
  });
  assert.equal(plan.close, null);
});

test("planScene returns null for an invalid input", () => {
  assert.equal(
    planScene(events, dm, { reason: "", after: seed, closeProposalId: null }),
    null,
  );
});

const combatDm = turnModeCombat.viewers.dm;
const combatEvents = turnModeCombat.events.filter((e) => e.seq <= 18);

test("planEncounterEnd with thenFree gives the end row then the free row", () => {
  const rows = planEncounterEnd(combatEvents, combatDm, {
    reason: "Done.",
    thenFree: true,
  });
  assert.deepEqual(
    rows.map((r) => r.eventType),
    ["encounter.ended", "table-mode.changed"],
  );
  assert.deepEqual(rows[1].payload.after, { mode: "free" });
});

test("planEncounterEnd without thenFree gives only the end row", () => {
  const rows = planEncounterEnd(combatEvents, combatDm, {
    reason: "Done.",
    thenFree: false,
  });
  assert.equal(rows.length, 1);
});

test("planEncounterEnd gives null with no encounter or a bad reason", () => {
  const ended = turnModeCombat.events;
  assert.equal(
    planEncounterEnd(ended, combatDm, { reason: "x", thenFree: true }),
    null,
  );
  assert.equal(
    planEncounterEnd(combatEvents, combatDm, {
      reason: "x".repeat(501),
      thenFree: false,
    }),
    null,
  );
});

test("planTableMode gives one row, or null when the frame refuses", () => {
  const rows = planTableMode(combatEvents, combatDm, {
    reason: "Free.",
    after: { mode: "free" },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eventType, "table-mode.changed");
  assert.equal(
    planTableMode(combatEvents, combatDm, {
      reason: "x",
      after: { mode: "turn" },
    }),
    null,
  );
});
