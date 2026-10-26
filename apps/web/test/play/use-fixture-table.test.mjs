import assert from "node:assert/strict";
import { test } from "node:test";
import { freeModeAction } from "@the-stacks/session-model/fixtures";
import {
  proposalsFor,
  viewerForKey,
} from "../../app/play/use-fixture-table.ts";

const dm = freeModeAction.viewers.dm;
const name = freeModeAction.name;

test("the DM sees the example proposals", () => {
  assert.ok(proposalsFor(name, dm, new Set()).length >= 2);
});

test("approve and reject remove the proposal from the list", () => {
  const all = proposalsFor(name, dm, new Set());
  const id = all[0].proposalId;
  const after = proposalsFor(name, dm, new Set([id]));
  assert.equal(after.length, all.length - 1);
  assert.ok(after.every((p) => p.proposalId !== id));
});

test("a player viewer receives no proposals", () => {
  const player = viewerForKey(
    freeModeAction,
    freeModeAction.viewers.players[0].userId,
  );
  assert.equal(player.role, "player");
  assert.deepEqual(proposalsFor(name, player, new Set()), []);
});
