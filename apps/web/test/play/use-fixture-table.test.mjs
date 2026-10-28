import assert from "node:assert/strict";
import { test } from "node:test";
import { dmApprovals } from "@the-stacks/session-model/fixtures";
import {
  planScene,
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
