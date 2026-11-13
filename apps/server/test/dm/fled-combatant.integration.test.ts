import { afterAll, describe, expect, it } from "vitest";
import {
  acceptDeed,
  count,
  DM,
  eventOf,
  fresh,
  initDice,
  inTurnMode,
  nextJob,
  rowsAfter,
  run,
  turnInto,
} from "./encounter-lifecycle.js";
import {
  checkBeside,
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  stage,
  stages,
  startScene,
} from "./world.js";

/**
 * Spec 099 US2 (TASK-0254): the lookout flees before the fight (seq 40) and the
 * fight starts without it; a fled monster leaves the order mid-fight (seq 161-164)
 * and gets no turn.
 */
loudSkip("fled-combatant.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const flee = (targetId: string) => ({
  effect: "presence",
  targetId,
  reason: "fled",
});

describe.skipIf(!reachable)("a fled combatant (database)", () => {
  it("fled in free mode: the encounter starts without it", async () => {
    // Initiative for 3 party + 3 remaining monsters.
    const w = await createWorld({ dice: initDice(0, 6) });
    await startScene(w);
    // The lookout arrives (a combatant), then flees in free mode.
    await run(w, { director: { arrivals: ["goblin-3"] }, job: nextJob() });
    fresh(w);
    const res = await w.gate.submit(w.sessionId, DM, {
      kind: "scene-presence",
      summary: "The lookout bolts",
      rationale: "The lookout flees before the fight.",
      reason: "fled",
      actorId: "goblin-3",
      actionId: null,
      visibility: "public",
    } as never);
    expect(res.ok).toBe(true);
    fresh(w);
    const p = await w.projections();
    expect(p.scenePresence["goblin-3"]?.presence).toBe("absent");

    const start = (await readRows(w)).length;
    await run(w, { director: turnInto(), job: nextJob() });
    const rows = await rowsAfter(w, start);
    const rolls = rows.filter(
      (r) => r.type === "dice.rolled" && eventOf(r).purpose === "initiative",
    );
    expect(rolls).toHaveLength(6);
    const order = (await w.projections()).encounter?.order.map(
      (o) => o.combatantId,
    );
    expect(order).not.toContain("goblin-3");
    expect(order).toContain("goblin-2");
  });

  it("fled mid-fight: the batch holds the departure and the monster gets no turn", async () => {
    const w = await inTurnMode(initDice(3), [acceptDeed]); // snag first
    const start = (await readRows(w)).length;
    const out = await run(w, {
      readings: [
        stages(null, [
          stage(
            { kind: "attempt", text: "Snag bolts" },
            checkBeside({ onFailure: [flee("snag")] }),
          ),
        ]),
      ] as never,
      job: { ...nextJob(), trigger: "npc-turn" },
    });
    expect(out.submissions.some((s) => s.kind === "scene-presence")).toBe(true);
    const rows = await rowsAfter(w, start);
    expect(count(rows, "scene-presence.changed")).toBe(1);
    const p = await w.projections();
    expect(p.encounter?.order.map((o) => o.combatantId)).not.toContain("snag");
    expect(p.encounter?.activeCombatantId).not.toBe("snag");
  });
});
