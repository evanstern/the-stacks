import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import { fixtureIds, turnModeCombat } from "@the-stacks/session-model/fixtures";
import { selectPendingProposals } from "../../app/play/proposals.ts";
import { toTableViewModel } from "../../app/play/view-model.ts";
import { viewerFor } from "../../app/play/viewer.ts";

const party = (userId) => [
  {
    characterId: "tamsin",
    name: "Tamsin",
    controller: { kind: "player", userId },
    combatantId: "tamsin",
  },
];
const proj = (seat, members) => ({ gate: { seat }, party: members });
const aiSeat = { kind: "ai" };
const operator = { id: "op-1", role: "operator" };
const player = { id: "pl-1", role: "player" };

test("viewerFor: the derivation table", () => {
  // operator holding the DM seat -> dm
  assert.deepEqual(
    viewerFor(operator, proj({ kind: "human", userId: "op-1" }, [])),
    { role: "dm" },
  );
  // operator seated as a character -> player with userId
  assert.deepEqual(viewerFor(operator, proj(aiSeat, party("op-1"))), {
    role: "player",
    userId: "op-1",
  });
  // unseated operator -> player (TASK-0118)
  assert.deepEqual(viewerFor(operator, proj(aiSeat, party("someone"))), {
    role: "player",
    userId: "op-1",
  });
  // unseated operator, AI seat, empty party -> player
  assert.deepEqual(viewerFor(operator, proj(aiSeat, [])), {
    role: "player",
    userId: "op-1",
  });
  // unseated operator, another user holds the human seat -> player
  assert.deepEqual(
    viewerFor(
      operator,
      proj({ kind: "human", userId: "dm-2" }, party("someone")),
    ),
    { role: "player", userId: "op-1" },
  );
  // operator controlling a character while dm-2 holds the human seat -> player
  assert.deepEqual(
    viewerFor(operator, proj({ kind: "human", userId: "dm-2" }, party("op-1"))),
    { role: "player", userId: "op-1" },
  );
  // player seated -> player
  assert.deepEqual(viewerFor(player, proj(aiSeat, party("pl-1"))), {
    role: "player",
    userId: "pl-1",
  });
  // player unseated -> player
  assert.deepEqual(viewerFor(player, proj(aiSeat, [])), {
    role: "player",
    userId: "pl-1",
  });
});

test("operator seated as a character: composer holds the character and Action is available", () => {
  const user = { id: fixtureIds.playerUserId, role: "operator" };
  const seed = project(turnModeCombat.events, { role: "dm" });
  const viewer = viewerFor(user, seed);
  assert.equal(viewer.role, "player");
  const model = toTableViewModel(project(turnModeCombat.events, viewer), {
    actor: user.id,
    proposals: [],
  });
  assert.deepEqual(
    model.composer.characters.map((c) => c.characterId),
    ["ana"],
  );
  assert.equal(model.composer.actionAvailable, true);
});

test("unseated operator at an AI seat: player view-model with no DM surface", () => {
  const user = { id: "op-unseated", role: "operator" };
  const viewer = viewerFor(
    user,
    project(turnModeCombat.events, { role: "dm" }),
  );
  assert.deepEqual(viewer, { role: "player", userId: user.id });
  const proposals = selectPendingProposals(turnModeCombat.events, {
    role: "dm",
  });
  const model = toTableViewModel(project(turnModeCombat.events, viewer), {
    actor: user.id,
    proposals,
  });
  assert.equal(model.isDm, false);
  assert.deepEqual(model.proposals, []);
  assert.deepEqual(model.composer.characters, []);
  assert.equal(model.composer.actionAvailable, false);
});
