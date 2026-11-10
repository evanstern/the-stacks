import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  attackStep,
  checkStep,
  commitAction,
  createWorld,
  db,
  loudSkip,
  payloadOf,
  player,
  reachable,
  reading,
  readRows,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 082 US1-US3 end to end over the greyhollow-ford seed: the engine derives
 * the modifier, DC, to-hit and damage from the stats set at combatant.add.
 */

loudSkip("derived-numbers.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

async function run(w: World, readings: unknown[], extra = {}) {
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

/** A party-scope action, so any party member may attack in it (spec 079 D5). */
async function commitParty(w: World, text: string) {
  const actionId = `act-party-${text.length}`;
  await w.as(player, {
    kind: "action.declare",
    action: { actionId, characterId: "tamsin", scope: "party", text },
  });
  await w.as(player, { kind: "action.commit", actionId });
  return actionId;
}

/** Initiative dice that put Tamsin first when the reed-camp encounter starts. */
const INIT = [20, 1, 1, 1, 1, 1, 1];
const startReedCamp = {
  director: {
    tableMode: {
      to: "turn" as const,
      encounterId: "reed-camp",
      reason: "The goblins rush out.",
    },
  },
};

type Ev = Record<string, unknown>;
const events = async (w: World, type: string) =>
  (await readRows(w))
    .filter((r) => r.type === type)
    .map((r) => payloadOf<{ event: Ev }>(r).event);

describe.skipIf(!reachable)("engine-derived numbers (database)", () => {
  it("a medium Athletics check rolls 1d20+5 against DC 15", async () => {
    const w = await createWorld({ dice: [10] });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const out = await run(w, [reading(id, [checkStep()])]);
    expect(out.planGate).toEqual([{ actionId: id, ok: true }]);
    const [dice] = await events(w, "dice.rolled");
    expect(dice).toMatchObject({ expression: "1d20+5" });
    const [check] = await events(w, "check.resolved");
    expect(check).toMatchObject({ dc: 15, difficulty: "medium", total: 15 });
  });

  it("Kestrel's Shortbow rolls 1d20+5 against the record AC and applies 1d6+3 piercing", async () => {
    const w = await createWorld({ dice: [...INIT, 15, 15, 4] });
    await startScene(w);
    const id = await commitParty(w, "We loose arrows at the goblin.");
    const out = await run(
      w,
      [
        reading(
          id,
          [
            attackStep("goblin-2", {
              attackerId: "kestrel",
              attack: "Shortbow",
            }),
          ],
          { intent: "attack" },
        ),
      ],
      startReedCamp,
    );
    expect(out.planGate).toEqual([{ actionId: id, ok: true }]);
    const rolled = (await events(w, "dice.rolled")).filter(
      (e) => e.purpose !== "initiative",
    );
    expect(rolled[0]).toMatchObject({ expression: "1d20+5" });
    const [attack] = await events(w, "attack.resolved");
    expect(attack).toMatchObject({
      attack: "Shortbow",
      outcome: "hit",
      ac: 15,
    });
    expect(rolled[1]).toMatchObject({ expression: "1d6+3", purpose: "damage" });
    const [applied] = await events(w, "hp.changed");
    expect(applied).toMatchObject({
      combatantId: "goblin-2",
      cause: "damage",
    });
  });

  it("an attack naming Warhammer is refused STAT_UNDEFINED with no dice row", async () => {
    const w = await createWorld({ dice: [...INIT] });
    await startScene(w);
    const id = await commitParty(w, "We loose arrows at the goblin.");
    const out = await run(
      w,
      [
        reading(
          id,
          [
            attackStep("goblin-2", {
              attackerId: "kestrel",
              attack: "Warhammer",
            }),
          ],
          { intent: "attack" },
        ),
      ],
      startReedCamp,
    );
    expect(out.planGate).toMatchObject([
      { ok: false, code: "STAT_UNDEFINED", failure: { field: "attack" } },
    ]);
    expect(
      (await events(w, "dice.rolled")).filter(
        (e) => e.purpose !== "initiative",
      ),
    ).toEqual([]);
    expect(await events(w, "attack.resolved")).toEqual([]);
  });
});
