import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import { fixtureIds, turnModeCombat } from "@the-stacks/session-model/fixtures";
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
  // unseated operator -> dm (fallback)
  assert.deepEqual(viewerFor(operator, proj(aiSeat, party("someone"))), {
    role: "dm",
  });
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
