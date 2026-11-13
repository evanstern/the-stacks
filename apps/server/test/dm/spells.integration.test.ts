import { mechanicsProposal } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  createWorld as baseWorld,
  db,
  loudSkip,
  payloadOf,
  reachable,
  readRows,
  stage,
  stages,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 083 US1-US4 end to end over the greyhollow-ford seed: Odo's spells
 * resolve through the engine, spend slots, and refuse what the table cannot.
 */

loudSkip("spells.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

/** Worlds script spare rulings: a cast the planner cannot settle asks the AI seat (spec 104). */
const createWorld = (opts: Parameters<typeof baseWorld>[0] = {}) =>
  baseWorld({ calls: [], ...opts });

async function run(w: World, readings: unknown[], extra = {}) {
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

/** Odo's own action: the stage actor is the declarer, so an Odo spell needs an Odo declaration. */
const odo = { kind: "ai", actor: "ai:companion:odo" } as const;
let spellN = 0;
async function commitParty(w: World, text: string) {
  const actionId = `act-spell-${++spellN}`;
  const d = await w.as(odo, {
    kind: "action.declare",
    action: { actionId, characterId: "odo", scope: "character", text },
  });
  if (!d.ok) throw new Error(`declare: ${d.refusal.code}`);
  const c = await w.as(odo, { kind: "action.commit", actionId });
  if (!c.ok) throw new Error(`commit: ${c.refusal.code}`);
  return actionId;
}

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
const nonInit = async (w: World) =>
  (await events(w, "dice.rolled")).filter((e) => e.purpose !== "initiative");

async function downKestrel(w: World) {
  const hp = (await w.projections()).engine.combatants.kestrel?.hp.current;
  const res = await w.gate.submit(
    w.sessionId,
    { kind: "ai", actor: "ai:dm" },
    mechanicsProposal(
      {
        type: "damage.apply",
        targetId: "kestrel",
        components: [
          { amount: { kind: "fixed", value: hp }, damageType: "slashing" },
        ],
        critical: false,
        defenses: null,
        reason: "setup",
      } as never,
      { actionId: null, summary: "setup", rationale: "setup" },
    ),
  );
  if (!res.ok) throw new Error(`setup refused: ${res.refusal.code}`);
}

const castStage = (target: string, spell: string, slot?: number) =>
  stage({
    kind: "cast",
    targets: [{ kind: "actor", id: target }],
    params: { spell, ...(slot ? { slot } : {}) },
  });
const castReading = (id: string, ...list: ReturnType<typeof castStage>[]) =>
  stages(id, list);

describe.skipIf(!reachable)("spells through the engine (database)", () => {
  it("Odo's sacred-flame lands a DC 13 save and radiant damage on a failure", async () => {
    const w = await createWorld({ dice: [...INIT, 5, 5] });
    await startScene(w);
    const id = await commitParty(w, "Odo calls down sacred flame.");
    const _out = await run(
      w,
      [castReading(id, castStage("goblin-2", "sacred-flame"))],
      startReedCamp,
    );
    const [save] = await events(w, "check.resolved");
    expect(save).toMatchObject({ dc: 13, spellId: "sacred-flame" });
    const rolled = await nonInit(w);
    expect(rolled[1]).toMatchObject({ expression: "1d8", purpose: "damage" });
    const [hp] = await events(w, "hp.changed");
    expect(hp).toMatchObject({ combatantId: "goblin-2", cause: "damage" });
  });

  it("Odo's cure-wounds heals a downed Kestrel 2d8+3 and she wakes", async () => {
    const w = await createWorld({ dice: [4, 5] });
    await startScene(w);
    await downKestrel(w);
    const id = await commitParty(w, "Odo kneels and mends Kestrel.");
    await run(w, [castReading(id, castStage("kestrel", "cure-wounds", 1))]);
    const rolled = await nonInit(w);
    expect(rolled.at(-1)).toMatchObject({ expression: "2d8+3" });
    const heals = (await events(w, "hp.changed")).filter(
      (e) => e.cause === "healing",
    );
    expect(heals[0]).toMatchObject({ combatantId: "kestrel", amount: 12 });
    const p = await w.projections();
    expect(p.engine.combatants.kestrel?.lifeState).toBe("conscious");
  });

  it("three cure-wounds casts spend both slots; the third is refused with no healing row", async () => {
    const w = await createWorld({ dice: [4, 5, 1, 1] });
    await startScene(w);
    await downKestrel(w);
    const id = await commitParty(w, "Odo mends Kestrel three times over.");
    const cast = (_n: number) => castStage("kestrel", "cure-wounds", 1);
    const _out = await run(w, [castReading(id, cast(1), cast(2), cast(3))]);
    const spent = await events(w, "spell-slots.changed");
    expect(spent).toHaveLength(2);
    const heals = (await events(w, "hp.changed")).filter(
      (e) => e.cause === "healing",
    );
    expect(heals).toHaveLength(2);
    // A refused command writes no row: the third cast leaves no slot, dice or healing row.
    expect(await nonInit(w)).toHaveLength(2);
  });

  // Run 1 seq 204-210 (rows are not in the repo; shape built from the engine's events):
  // Kestrel at 0 HP, Odo casts Cure Wounds, spends a 1st-level slot, she wakes, and a cast
  // with no slot left is refused.
  it("replays run 1 seq 204-210: a 0 HP revive spends the last slot, then a cast is refused", async () => {
    const w = await createWorld({ dice: [4, 5, 4, 5, 1, 1] });
    await startScene(w);
    await downKestrel(w);
    const first = await commitParty(w, "Odo mends Kestrel once.");
    const cast = (_n: number) => castStage("kestrel", "cure-wounds", 1);
    await run(w, [castReading(first, cast(1))]);
    expect((await events(w, "spell-slots.changed")).at(-1)).toMatchObject({
      combatantId: "odo",
      after: { level: 1, expended: 1 },
    });
    await downKestrel(w); // back to 0 HP, as at seq 204
    const second = await commitParty(w, "Odo mends Kestrel again, longer.");
    await run(w, [castReading(second, cast(2))]);
    expect((await events(w, "spell-slots.changed")).at(-1)).toMatchObject({
      after: { level: 1, expended: 2 },
    });
    expect((await w.projections()).engine.combatants.kestrel?.lifeState).toBe(
      "conscious",
    );
    await downKestrel(w);
    const third = await commitParty(w, "Odo mends Kestrel a third time.");
    const out = await run(w, [castReading(third, cast(3))]);
    expect(out.actionResults[0]).toMatchObject({
      outcome: "refused",
      refusalCode: "NO_SLOT_AVAILABLE",
    });
    expect(await events(w, "spell-slots.changed")).toHaveLength(2);
    expect(
      (await w.projections()).engine.combatants.kestrel?.lifeState,
    ).not.toBe("conscious");
  });
});
