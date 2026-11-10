import { afterAll, describe, expect, it } from "vitest";
import {
  count,
  eventOf,
  fresh,
  initDice,
  inTurnMode,
  nextJob,
  rowsAfter,
  run,
} from "./encounter-lifecycle.js";
import { db, loudSkip, reachable, readRows } from "./world.js";

/**
 * Spec 099 US1 (TASK-0253): runbook B2 seq 193-205. A toll ends the reed-camp
 * fight (Director `free`); a later `turn` decision on the same encounter
 * resumes it with fresh initiative and no opening setup.
 */
loudSkip("encounter-resume.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)("encounter resume (database)", () => {
  it("rolls initiative once over eligible ids, adds nobody, runs no start presence rows", async () => {
    // Start: 7 initiative dice. Resume: 3 party + 4 monsters again.
    const w = await inTurnMode([...initDice(0), ...initDice(0)]);
    await run(w, {
      director: { tableMode: { to: "free", reason: "A toll is paid." } },
      job: nextJob(),
    });
    fresh(w);
    const mid = await w.projections();
    expect(mid.encounter).toBeNull();
    expect(mid.tableMode.mode).toBe("free");

    const start = (await readRows(w)).length;
    await run(w, {
      director: {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "Broken." },
      },
      job: nextJob(),
    });
    const rows = await rowsAfter(w, start);
    expect(count(rows, "combatant.added")).toBe(0);
    expect(count(rows, "scene-presence.changed")).toBe(0);
    expect(count(rows, "encounter.started")).toBe(1);
    const rolls = rows.filter(
      (r) => r.type === "dice.rolled" && eventOf(r).purpose === "initiative",
    );
    const after = await w.projections();
    expect(rolls).toHaveLength(after.encounter?.order.length ?? -1);
    expect(after.tableMode.mode).toBe("turn");
  });

  it("a resume skips a dead monster", async () => {
    const w = await inTurnMode([...initDice(0), ...initDice(0)]);
    await run(w, {
      director: { tableMode: { to: "free", reason: "Toll." } },
      job: nextJob(),
    });
    fresh(w);
    const { cmd } = await import("./encounter-lifecycle.js");
    await cmd(w, {
      type: "damage.apply",
      targetId: "goblin-3",
      components: [
        { amount: { kind: "fixed", value: 99 }, damageType: "slashing" },
      ],
      critical: false,
      defenses: null,
    });
    await run(w, {
      director: {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "Broken." },
      },
      job: nextJob(),
    });
    const order = (await w.projections()).encounter?.order.map(
      (o) => o.combatantId,
    );
    expect(order).not.toContain("goblin-3");
    expect(order).toContain("snag");
  });
});
