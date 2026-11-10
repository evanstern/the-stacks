import { afterAll, describe, expect, it } from "vitest";
import {
  cmd,
  count,
  eventOf,
  initDice,
  inTurnMode,
  nextJob,
  rowsAfter,
  run,
} from "./encounter-lifecycle.js";
import { db, loudSkip, reachable, readRows } from "./world.js";

/** Spec 099 US4: a turn-mode arrival joins the order and rolls alone. */
loudSkip("mid-fight-arrival.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)("a mid-fight arrival (database)", () => {
  it("goblin-4 joins with one add, one join and one initiative roll; the active combatant holds", async () => {
    // Seven initiative dice, then goblin-4's own roll.
    const w = await inTurnMode([...initDice(0), 15]);
    // goblin-4 leaves the scene entirely, so the running fight has a newcomer to receive.
    await cmd(w, { type: "combatant.depart", combatantId: "goblin-4" });
    await cmd(w, { type: "combatant.remove", combatantId: "goblin-4" });
    const before = await w.projections();
    expect(before.engine.combatants["goblin-4"]).toBeUndefined();
    const active = before.encounter?.activeCombatantId;

    const start = (await readRows(w)).length;
    await run(w, { director: { arrivals: ["goblin-4"] }, job: nextJob() });
    const rows = await rowsAfter(w, start);
    const adds = rows.filter((r) => r.type === "combatant.added");
    expect(adds).toHaveLength(1);
    expect(eventOf(adds[0] as never).after.side).toBe("hostile");
    const rolls = rows.filter(
      (r) => r.type === "dice.rolled" && eventOf(r).purpose === "initiative",
    );
    expect(rolls).toHaveLength(1);
    expect(count(rows, "encounter.changed")).toBeGreaterThanOrEqual(1);
    const after = await w.projections();
    expect(after.encounter?.order.map((o) => o.combatantId)).toContain(
      "goblin-4",
    );
    expect(after.encounter?.activeCombatantId).toBe(active);
  });
});
