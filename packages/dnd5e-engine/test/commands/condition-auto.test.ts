import { describe, expect, it } from "vitest";
import {
  type Combatant,
  type EngineEvent,
  type EngineState,
  replay,
  SPELLS,
} from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

// Spec 119: SRD 5.2.1 paralyzed, petrified, stunned, unconscious (Str and Dex saves fail);
// paralyzed, unconscious (a hit within 5 feet is a Critical Hit).
const stats = (over = {}) => ({
  abilityMods: { str: 3, dex: 2, con: 0, wis: 3 },
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks: [
    { name: "Sword", range: "melee" as const, toHit: 4, damage: [] },
    {
      name: "Bow",
      range: "ranged" as const,
      rangeFt: { normal: 80, long: 320 },
      toHit: 4,
      damage: [],
    },
    {
      name: "Spear",
      range: "melee-or-ranged" as const,
      reachFt: 5,
      rangeFt: { normal: 30, long: 120 },
      toHit: 4,
      damage: [],
    },
  ],
  spellcastingAbility: "wis" as const,
  ...over,
});
const slots = { standard: { "1": { max: 2, expended: 0 } }, pact: null };
const mk = (id: string, over: Partial<Combatant> = {}) =>
  makeCombatant({
    id,
    name: id,
    ac: 13,
    speed: 30,
    stats: stats(),
    spellSlots: slots,
    ...over,
  });
const cond = (condition: string) => ({
  instanceId: `c-${condition}`,
  condition,
  level: null,
  source: "test",
  expiresAt: null,
});
const withCond = (...c: string[]) => ({ conditions: c.map(cond) as never });
const rollInit = (ids: string[]) => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
  reason: "combat begins",
});
const advance = { type: "turn.advance", reason: "next turn" };
const dodge = (combatantId: string) => ({
  type: "dodge",
  combatantId,
  reason: "dodges",
});
/** Order: a (15), b (10), c (5). a is active. */
function started(over: Record<string, Partial<Combatant>> = {}): EngineState {
  const state = stateWith(mk("a", over.a), mk("b", over.b), mk("c", over.c));
  return settle(
    state,
    run(state, rollInit(["a", "b", "c"]), [15, 10, 5]).result,
  );
}
const play = (state: EngineState, command: unknown, faces: number[] = []) =>
  settle(state, run(state, command, faces).result);

const save = (id: string, ability: string, over = {}) => ({
  type: "check.roll",
  combatantId: id,
  kind: "saving-throw",
  ability,
  dc: 12,
  reason: "save",
  ...over,
});
const swing = (attack: string, over = {}) => ({
  type: "attack.roll",
  attackerId: "a",
  targetId: "b",
  attack,
  reason: "swing",
  ...over,
});
const cast = (spellId: string, over = {}) => ({
  type: "spell.cast",
  casterId: "a",
  spellId,
  targetId: "b",
  slotLevel: SPELLS[spellId]?.level ? SPELLS[spellId].level : null,
  casterLevel: 1,
  reason: "casts",
  ...over,
});
/** b dodges on its own turn, then holds `c`; a is active again in round 2. */
function dodgerWith(c: string): EngineState {
  const s = play(play(started(), advance), dodge("b"));
  const held = play(s, {
    type: "condition.apply",
    targetId: "b",
    condition: c,
    source: "test",
    reason: "held",
  });
  return play(play(held, advance), advance);
}
const target = (...c: string[]) => stateWith(mk("a"), mk("b", withCond(...c)));

describe("derived automatic save failure (spec 119)", () => {
  for (const c of ["paralyzed", "petrified", "stunned", "unconscious"]) {
    for (const ability of ["str", "dex"]) {
      it(`${c} fails a ${ability} save with no draw`, () => {
        const out = run(target(c), save("b", ability, { combatantId: "b" }));
        const events = expectOk(out.result);
        expect(out.counter.draws()).toBe(0);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: "check.resolved",
          outcome: "failure",
          band: "failure",
          total: null,
          natural: null,
          rollIndex: null,
          autoFail: { reason: `b is ${c}` },
        });
      });
    }
  }

  it("a paralyzed combatant's con save rolls normally", () => {
    const events = expectOk(
      run(target("paralyzed"), save("b", "con"), [15]).result,
    );
    expect(events[0]).toMatchObject({ mode: "normal" });
    expect(events[1]).toMatchObject({ outcome: "success", autoFail: null });
  });

  it("an incapacitated-only combatant's dex save rolls", () => {
    const out = run(target("incapacitated"), save("b", "dex"), [15]);
    expect(expectOk(out.result)[1]).toMatchObject({ autoFail: null });
    expect(out.counter.draws()).toBe(1);
  });

  it("a restrained dex save rolls with disadvantage and does not auto-fail", () => {
    const events = expectOk(
      run(target("restrained"), save("b", "dex"), [15, 3]).result,
    );
    expect(events[0]).toMatchObject({ mode: "disadvantage" });
    expect(events[1]).toMatchObject({ autoFail: null });
  });

  it("an explicit expression save auto-fails too", () => {
    const out = run(
      target("stunned"),
      save("b", "dex", { expression: "1d20+2" }),
    );
    expect(expectOk(out.result)[0]).toMatchObject({
      autoFail: { reason: "b is stunned" },
    });
    expect(out.counter.draws()).toBe(0);
  });

  it("a stunned dodger with command advantage still auto-fails", () => {
    const s = dodgerWith("stunned");
    const out = run(s, save("b", "dex", { mode: "advantage" }));
    expect(expectOk(out.result)[0]).toMatchObject({ outcome: "failure" });
    expect(out.counter.draws()).toBe(0);
  });

  it("a command autoFail reason wins", () => {
    const events = expectOk(
      run(
        target("paralyzed"),
        save("b", "str", { autoFail: { reason: "held fast" } }),
      ).result,
    );
    expect(events[0]).toMatchObject({ autoFail: { reason: "held fast" } });
  });

  it("a derived failure beats a command autoSuccess", () => {
    const events = expectOk(
      run(
        target("paralyzed"),
        save("b", "str", { autoSuccess: { reason: "lucky" } }),
      ).result,
    );
    expect(events[0]).toMatchObject({
      outcome: "failure",
      autoFail: { reason: "b is paralyzed" },
    });
  });

  it("a combatant dropped to 0 HP auto-fails a dex save, and still does once stable", () => {
    const base = stateWith(mk("b", { hp: { current: 3, max: 12, temp: 0 } }));
    const hit = {
      type: "damage.apply",
      targetId: "b",
      components: [
        { amount: { kind: "fixed", value: 9 }, damageType: "slashing" },
      ],
      reason: "hit",
    };
    const s1 = play(base, hit);
    expect(s1.combatants.b?.lifeState).toBe("unconscious");
    const dex = save("b", "dex");
    expect(expectOk(run(s1, dex).result)[0]).toMatchObject({
      autoFail: { reason: "b is unconscious" },
    });
    const s2 = play(s1, {
      type: "stabilize",
      targetId: "b",
      reason: "medicine",
    });
    expect(s2.combatants.b?.lifeState).toBe("stable");
    expect(expectOk(run(s2, dex).result)[0]).toMatchObject({
      outcome: "failure",
      total: null,
    });
  });

  it("a paralyzed combatant with no stats and no expression refuses STAT_UNDEFINED", () => {
    expectRefusedBeforeDraw(
      run(
        stateWith(mk("b", { ...withCond("paralyzed"), stats: undefined })),
        save("b", "dex"),
      ),
      "STAT_UNDEFINED",
    );
  });

  it("sacred-flame on a paralyzed target draws no save die and deals full damage", () => {
    const out = run(target("paralyzed"), cast("sacred-flame"), [6]);
    const events = expectOk(out.result);
    expect(
      events.some((e) => e.type === "dice.rolled" && e.purpose === "save"),
    ).toBe(false);
    expect(events.find((e) => e.type === "check.resolved")).toMatchObject({
      spellId: "sacred-flame",
      outcome: "failure",
      autoFail: { reason: "b is paralyzed" },
    });
    expect(events.find((e) => e.type === "hp.changed")).toMatchObject({
      amount: 6,
    });
    expect(out.counter.draws()).toBe(1);
  });

  it("inflict-wounds (a con save) on a paralyzed target rolls its save", () => {
    const events = expectOk(
      run(target("paralyzed"), cast("inflict-wounds"), [18, 4, 5]).result,
    );
    expect(
      events.some((e) => e.type === "dice.rolled" && e.purpose === "save"),
    ).toBe(true);
  });
});

describe("derived automatic critical hit (spec 119)", () => {
  const faces = [12, 3];
  const outcomeOf = (events: EngineEvent[]) =>
    events.find((e) => e.type === "attack.resolved");

  for (const c of ["paralyzed", "unconscious"]) {
    it(`Sword on ${c}: advantage, natural 12, critical-hit`, () => {
      const events = expectOk(run(target(c), swing("Sword"), faces).result);
      expect(events[0]).toMatchObject({ mode: "advantage" });
      expect(outcomeOf(events)).toMatchObject({
        natural: 12,
        outcome: "critical-hit",
      });
    });
  }

  it("a paralyzed target is still missed on a low roll or a natural 1", () => {
    expect(
      outcomeOf(
        expectOk(run(target("paralyzed"), swing("Sword"), [3, 2]).result),
      ),
    ).toMatchObject({ outcome: "miss" });
    expect(
      outcomeOf(
        expectOk(run(target("paralyzed"), swing("Sword"), [1, 1]).result),
      ),
    ).toMatchObject({ outcome: "miss" });
  });

  for (const c of ["stunned", "petrified"]) {
    it(`Sword on ${c}: advantage, plain hit`, () => {
      const events = expectOk(run(target(c), swing("Sword"), faces).result);
      expect(events[0]).toMatchObject({ mode: "advantage" });
      expect(outcomeOf(events)).toMatchObject({ outcome: "hit" });
    });
  }

  it("Bow on a paralyzed target is a plain hit", () => {
    expect(
      outcomeOf(expectOk(run(target("paralyzed"), swing("Bow"), faces).result)),
    ).toMatchObject({ outcome: "hit" });
  });

  describe("Spear (melee-or-ranged)", () => {
    const zone = (id: string) => ({
      id,
      name: id,
      kind: "room",
      tags: [],
      hidden: false,
    });
    const place = (s: EngineState, id: string, zoneId: string) =>
      play(s, {
        type: "combatant.place",
        combatantId: id,
        zoneId,
        reason: "p",
      });
    const scene = (bZone: string) => {
      let s = play(target("paralyzed"), {
        type: "space.define",
        space: {
          zones: ["za", "zb"].map(zone),
          edges: [{ from: "za", to: "zb", kind: "open", feet: 30 }],
        },
        reason: "scene",
      });
      s = place(s, "a", "za");
      return place(s, "b", bZone);
    };

    it("in the same zone (engaged) is a critical-hit", () => {
      expect(
        outcomeOf(expectOk(run(scene("za"), swing("Spear"), faces).result)),
      ).toMatchObject({ outcome: "critical-hit" });
    });

    it("one zone apart (a ranged use) is advantage and a plain hit", () => {
      const events = expectOk(run(scene("zb"), swing("Spear"), faces).result);
      expect(events[0]).toMatchObject({ mode: "advantage" });
      expect(outcomeOf(events)).toMatchObject({ outcome: "hit" });
    });
  });

  it("a reaction Sword attack on an unconscious target is a critical-hit and spends the Reaction", () => {
    const s = started({ b: withCond("unconscious") });
    const out = run(
      s,
      swing("Sword", { attackerId: "c", reaction: true }),
      faces,
    );
    expect(outcomeOf(expectOk(out.result))).toMatchObject({
      outcome: "critical-hit",
    });
    expect(settle(s, out.result).encounter?.reactionsSpent).toEqual(["c"]);
  });

  it("an explicit-expression attack derives no automatic critical hit", () => {
    const out = run(
      target("paralyzed"),
      {
        type: "attack.roll",
        attackerId: "a",
        targetId: "b",
        expression: "1d20+4",
        mode: "advantage",
        reason: "swing",
      },
      faces,
    );
    expect(outcomeOf(expectOk(out.result))).toMatchObject({ outcome: "hit" });
  });

  it("fire-bolt on a paralyzed target is a plain hit", () => {
    const events = expectOk(
      run(target("paralyzed"), cast("fire-bolt"), [12, 3, 5]).result,
    );
    expect(events[0]).toMatchObject({ mode: "advantage" });
    expect(outcomeOf(events)).toMatchObject({ outcome: "hit" });
  });

  it("a poisoned attacker rolls normal against a paralyzed target and still crits", () => {
    const s = stateWith(
      mk("a", withCond("poisoned")),
      mk("b", withCond("paralyzed")),
    );
    const events = expectOk(run(s, swing("Sword"), [14]).result);
    expect(events[0]).toMatchObject({ mode: "normal" });
    expect(outcomeOf(events)).toMatchObject({ outcome: "critical-hit" });
  });

  it("a paralyzed dodger loses Dodge: advantage, critical-hit", () => {
    const events = expectOk(
      run(dodgerWith("paralyzed"), swing("Sword"), faces).result,
    );
    expect(events[0]).toMatchObject({ mode: "advantage" });
    expect(outcomeOf(events)).toMatchObject({ outcome: "critical-hit" });
  });
});

describe("downed hero (spec 119)", () => {
  it("a Sword hit crits and a critical damage hit adds two death-save failures", () => {
    const downed = mk("b", {
      hp: { current: 0, max: 12, temp: 0 },
      lifeState: "unconscious",
      zeroHpRule: "death-saves",
      deathSaves: { successes: 0, failures: 0 },
      conditions: [{ ...cond("unconscious"), source: "hp-zero" }] as never,
      conditionSeq: 1,
    });
    const s0 = stateWith(mk("a"), downed);
    const out = run(s0, swing("Sword"), [12, 3]);
    const events = expectOk(out.result);
    expect(events.find((e) => e.type === "attack.resolved")).toMatchObject({
      outcome: "critical-hit",
    });
    const dmg = run(s0, {
      type: "damage.apply",
      targetId: "b",
      components: [
        { amount: { kind: "fixed", value: 3 }, damageType: "slashing" },
      ],
      critical: true,
      reason: "crit",
    });
    const s1 = settle(s0, dmg.result);
    expect(s1.combatants.b?.deathSaves.failures).toBe(2);
    expect(replay(expectOk(dmg.result), s0)).toEqual(s1);
  });
});
