import assert from "node:assert/strict";
import { test } from "node:test";
import { project } from "@the-stacks/session-model";
import { fixtureIds, groupSignoff } from "@the-stacks/session-model/fixtures";
import { signoffRows } from "../../app/play/signoff.ts";

const ANA = fixtureIds.playerUserId;
const CLEO = fixtureIds.otherPlayerUserId;
const label = (id) => (id === ANA ? "Ana" : id === CLEO ? "Cleo" : id);
const rowsAt = (through, viewerId, present) => {
  const viewer = { role: "player", userId: viewerId };
  const p = project(
    groupSignoff.events.filter((e) => e.seq <= through),
    viewer,
  );
  const action = p.actions.find((a) => a.actionId === "act-p1");
  return signoffRows(action, p.party, present, viewer, label);
};

test("declarer approves, the other waits; own row is flagged", () => {
  const rows = rowsAt(4, CLEO, [ANA, CLEO]);
  assert.deepEqual(
    rows.map((r) => [r.userId, r.state, r.isViewer]),
    [
      [ANA, "approved", false],
      [CLEO, "waiting", true],
    ],
  );
});

test("an objection shows as objects", () => {
  const rows = rowsAt(5, ANA, [ANA, CLEO]);
  assert.equal(rows.find((r) => r.userId === CLEO).state, "objects");
});

test("a human outside the present set is absent", () => {
  const rows = rowsAt(4, ANA, [ANA]);
  assert.equal(rows.find((r) => r.userId === CLEO).state, "absent");
});

test("present null shows every party human as present (never absent)", () => {
  const rows = rowsAt(4, ANA, null);
  assert.deepEqual(
    rows.map((r) => r.state),
    ["approved", "waiting"],
  );
});

test("character scope and one-human parties give no rows", () => {
  const viewer = { role: "player", userId: ANA };
  const p = project(
    groupSignoff.events.filter((e) => e.seq <= 4),
    viewer,
  );
  const action = p.actions.find((a) => a.actionId === "act-p1");
  assert.equal(
    signoffRows(
      { ...action, scope: "character" },
      p.party,
      null,
      viewer,
      label,
    ),
    null,
  );
  const solo = p.party.filter((m) => m.characterId !== "cleo");
  assert.equal(signoffRows(action, solo, null, viewer, label), null);
});
