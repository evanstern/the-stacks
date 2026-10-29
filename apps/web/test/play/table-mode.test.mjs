import assert from "node:assert/strict";
import { test } from "node:test";
import { activeActorFor, project } from "@the-stacks/session-model";
import { turnModeCombat } from "@the-stacks/session-model/fixtures";
import { appendLocal, localTableModeEvents } from "../../app/play/local-log.ts";
import { tableModeView } from "../../app/play/table-mode.ts";

const dm = turnModeCombat.viewers.dm;
const combatAt = (seq) =>
  project(
    turnModeCombat.events.filter((e) => e.seq <= seq),
    dm,
  );

test("turn mode with an encounter offers End and Free, no turn switch", () => {
  const v = tableModeView(combatAt(18));
  assert.equal(v.mode, "turn");
  assert.equal(v.encounterActive, true);
  assert.equal(v.canEnd, true);
  assert.equal(v.canFree, true);
  assert.equal(v.turnAfter, null);
});

test("free mode with an encounter offers End and a turn switch", () => {
  const events = turnModeCombat.events.filter((e) => e.seq <= 18);
  const p = project(events, dm);
  const row = localTableModeEvents(p, {
    reason: "Free.",
    after: { mode: "free" },
  });
  const p2 = project(appendLocal(events, row, "u"), dm);
  const v = tableModeView(p2);
  assert.equal(v.mode, "free");
  assert.equal(v.canEnd, true);
  assert.equal(v.canFree, false);
  assert.deepEqual(v.turnAfter, {
    mode: "turn",
    ...activeActorFor(p2, p2.encounter.activeCombatantId),
  });
});

test("after the encounter ends in free mode nothing is offered", () => {
  const last = turnModeCombat.events.at(-1).seq;
  const v = tableModeView(combatAt(last));
  assert.equal(v.encounterActive, false);
  assert.equal(v.canEnd, false);
  assert.equal(v.canFree, v.mode === "turn");
  assert.equal(v.turnAfter, null);
});
