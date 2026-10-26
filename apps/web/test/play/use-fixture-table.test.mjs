import assert from "node:assert/strict";
import { test } from "node:test";
import { dmApprovals } from "@the-stacks/session-model/fixtures";
import {
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
