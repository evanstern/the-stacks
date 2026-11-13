import { afterAll, describe, expect, it } from "vitest";
import {
  acceptDeed,
  cmd,
  count,
  initDice,
  inTurnMode,
  nextJob,
  rowsAfter,
  run,
} from "./encounter-lifecycle.js";
import {
  checkBeside,
  db,
  loudSkip,
  reachable,
  readRows,
  stage,
  stages,
} from "./world.js";

/** Spec 099 US3: code ends a fight no foe stands in (R1 exit 6, "end"). */
loudSkip("encounter-auto-end.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const kill = (w: Parameters<typeof cmd>[0], id: string) =>
  cmd(w, {
    type: "damage.apply",
    targetId: id,
    components: [
      { amount: { kind: "fixed", value: 99 }, damageType: "slashing" },
    ],
    critical: false,
    defenses: null,
  });
const MONSTERS = ["snag", "goblin-2", "goblin-3", "goblin-4"];

describe.skipIf(!reachable)("code-owned encounter end (database)", () => {
  it("the last hostile dies: encounter.ended and free mode land in the same job, no advance", async () => {
    const w = await inTurnMode(initDice(0));
    for (const id of MONSTERS) await kill(w, id);
    const start = (await readRows(w)).length;
    await run(w, { job: nextJob() });
    const rows = await rowsAfter(w, start);
    expect(count(rows, "encounter.ended")).toBe(1);
    expect(count(rows, "turn.advanced")).toBe(0);
    const modeRows = rows.filter((r) => r.type === "table-mode.changed");
    expect(modeRows.at(-1)?.payload).toMatchObject({ after: { mode: "free" } });
    const p = await w.projections();
    expect(p.encounter).toBeNull();
    expect(p.tableMode.mode).toBe("free");
  });

  it("the last hostile surrenders: it goes neutral and the fight ends", async () => {
    const w = await inTurnMode(initDice(3), [acceptDeed]); // snag first
    for (const id of MONSTERS.slice(1)) await kill(w, id);
    const start = (await readRows(w)).length;
    await run(w, {
      readings: [
        stages(null, [
          stage(
            { kind: "attempt", text: "Snag throws down his blade" },
            checkBeside({
              onFailure: [
                { effect: "presence", targetId: "snag", reason: "surrendered" },
              ],
            }),
          ),
        ]),
      ] as never,
      job: { ...nextJob(), trigger: "npc-turn" },
    });
    const rows = await rowsAfter(w, start);
    expect(count(rows, "combatant.sided")).toBe(1);
    expect(count(rows, "encounter.ended")).toBe(1);
    expect((await w.projections()).engine.combatants.snag?.side).toBe(
      "neutral",
    );
    expect((await w.projections()).tableMode.mode).toBe("free");
  });

  it("a downed party with a hostile standing does not end the fight (OQ-6)", async () => {
    const w = await inTurnMode(initDice(3));
    for (const id of ["tamsin", "odo", "kestrel"]) await kill(w, id);
    const start = (await readRows(w)).length;
    await run(w, { job: nextJob() });
    const rows = await rowsAfter(w, start);
    expect(count(rows, "encounter.ended")).toBe(0);
    expect((await w.projections()).encounter).not.toBeNull();
  });
});
