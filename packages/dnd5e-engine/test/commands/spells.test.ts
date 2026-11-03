import { describe, expect, it } from "vitest";
import type { EngineState } from "../../src/index.js";
import { SPELLS, spellDice } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const stats = (ability: "wis" | "int" | null = "wis") => ({
  abilityMods: { wis: 3, int: 3, dex: 1, con: 0 },
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks: [],
  spellcastingAbility: ability,
});
const slots = { standard: { "1": { max: 2, expended: 0 } }, pact: null };
const caster = (over = {}) =>
  makeCombatant({
    id: "pc-odo",
    name: "Odo",
    stats: stats(),
    spellSlots: slots,
    ...over,
  });
const foe = (over = {}) =>
  makeCombatant({
    id: "m-goblin",
    name: "Goblin",
    ac: 15,
    stats: stats(null),
    ...over,
  });
const cast = (spellId: string, over: Record<string, unknown> = {}) => ({
  type: "spell.cast",
  casterId: "pc-odo",
  spellId,
  targetId: "m-goblin",
  slotLevel: SPELLS[spellId]?.level ? SPELLS[spellId].level : null,
  casterLevel: 1,
  reason: "casts a spell",
  ...over,
});
const world = (c = caster(), t = foe()) => stateWith(c, t);

describe("spell.cast attack spells", () => {
  it("fire-bolt hit rolls 1d20+5 vs AC then 1d10 fire", () => {
    const out = run(world(), cast("fire-bolt"), [10, 6]);
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      expression: "1d20+5",
    });
    expect(events[1]).toMatchObject({
      type: "attack.resolved",
      outcome: "hit",
      total: 15,
      spellId: "fire-bolt",
    });
    expect(events[3]).toMatchObject({
      type: "hp.changed",
      amount: 6,
      components: [{ damageType: "fire" }],
    });
    expect(events.some((e) => e.type === "spell-slots.changed")).toBe(false);
    expect(settle(world(), out.result).combatants["m-goblin"]?.hp.current).toBe(
      6,
    );
  });

  it("fire-bolt miss deals no damage", () => {
    const events = expectOk(run(world(), cast("fire-bolt"), [2]).result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
    expect(events[1]).toMatchObject({ outcome: "miss" });
  });

  it("fire-bolt critical doubles the damage dice", () => {
    const events = expectOk(run(world(), cast("fire-bolt"), [20, 4, 5]).result);
    expect(events[1]).toMatchObject({ outcome: "critical-hit" });
    expect(events[3]).toMatchObject({
      type: "hp.changed",
      amount: 9,
      critical: true,
    });
  });

  it("fire-bolt at caster level 5 rolls 2d10", () => {
    const out = run(world(), cast("fire-bolt", { casterLevel: 5 }), [10, 3, 4]);
    expect(expectOk(out.result)[2]).toMatchObject({ expression: "2d10" });
    expect(out.rng.remaining()).toBe(0);
  });

  it("ray-of-sickness hit applies poisoned to the caster's next turn end", () => {
    const enc = (turnIndex: number): EngineState => ({
      ...world(),
      encounter: {
        round: 1,
        turnIndex,
        order: [
          { combatantId: "pc-odo", total: 15, bonus: 0 },
          { combatantId: "m-goblin", total: 10, bonus: 0 },
        ],
      },
    });
    // Active caster: round 2.
    const active = expectOk(
      run(enc(0), cast("ray-of-sickness"), [10, 4, 4]).result,
    );
    const applied = active.find((e) => e.type === "condition.applied");
    expect(applied).toMatchObject({
      after: {
        condition: "poisoned",
        expiresAt: { round: 2, combatantId: "pc-odo", boundary: "turn-end" },
      },
    });
    // Caster later in the order: this round.
    const later: EngineState = enc(1);
    later.encounter = {
      round: 1,
      turnIndex: 0,
      order: [
        { combatantId: "m-goblin", total: 15, bonus: 0 },
        { combatantId: "pc-odo", total: 10, bonus: 0 },
      ],
    };
    const ahead = expectOk(
      run(later, cast("ray-of-sickness"), [10, 4, 4]).result,
    );
    expect(ahead.find((e) => e.type === "condition.applied")).toMatchObject({
      after: { expiresAt: { round: 1, combatantId: "pc-odo" } },
    });
  });

  it("ray-of-sickness outside an encounter applies damage and no condition", () => {
    const events = expectOk(
      run(world(), cast("ray-of-sickness"), [10, 4, 4]).result,
    );
    expect(events.some((e) => e.type === "hp.changed")).toBe(true);
    expect(events.some((e) => e.type === "condition.applied")).toBe(false);
  });

  it("a poisoned caster's spell attack rolls with disadvantage", () => {
    const poisoned = caster({
      conditions: [
        {
          instanceId: "pc-odo#1",
          condition: "poisoned",
          level: null,
          source: "x",
          expiresAt: null,
        },
      ],
      conditionSeq: 1,
    });
    const events = expectOk(
      run(world(poisoned), cast("fire-bolt"), [15, 2]).result,
    );
    expect(events[0]).toMatchObject({ mode: "disadvantage", natural: 2 });
  });
});

describe("spell.cast save spells", () => {
  it("sacred-flame failed save deals 1d8 radiant at DC 13", () => {
    const events = expectOk(run(world(), cast("sacred-flame"), [5, 7]).result);
    expect(events[1]).toMatchObject({
      type: "check.resolved",
      kind: "saving-throw",
      ability: "dex",
      dc: 13,
      outcome: "failure",
      spellId: "sacred-flame",
    });
    expect(events[3]).toMatchObject({ type: "hp.changed", amount: 7 });
  });

  it("sacred-flame success deals nothing", () => {
    const events = expectOk(run(world(), cast("sacred-flame"), [18]).result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "check.resolved",
    ]);
  });

  it("inflict-wounds success halves 2d10 rounded down", () => {
    const events = expectOk(
      run(world(), cast("inflict-wounds"), [18, 4, 5]).result,
    );
    const hp = events.find((e) => e.type === "hp.changed");
    expect(hp).toMatchObject({ amount: 4, rawAmount: 4, half: true });
    expect(events[0]).toMatchObject({ type: "spell-slots.changed" });
  });

  it("inflict-wounds at slot 2 rolls 3d10", () => {
    const state = world(
      caster({
        spellSlots: { standard: { "2": { max: 1, expended: 0 } }, pact: null },
      }),
    );
    const out = run(
      state,
      cast("inflict-wounds", { slotLevel: 2 }),
      [2, 1, 1, 1],
    );
    expect(expectOk(out.result)[3]).toMatchObject({ expression: "3d10" });
  });

  it("a restrained target's Dex save rolls with disadvantage", () => {
    const restrained = foe({
      conditions: [
        {
          instanceId: "m-goblin#1",
          condition: "restrained",
          level: null,
          source: "x",
          expiresAt: null,
        },
      ],
      conditionSeq: 1,
    });
    const events = expectOk(
      run(world(caster(), restrained), cast("sacred-flame"), [18, 3, 1]).result,
    );
    expect(events[0]).toMatchObject({ mode: "disadvantage" });
  });
});

describe("spell.cast healing spells", () => {
  const hurt = () => foe({ hp: { current: 1, max: 40, temp: 0 } });
  it("cure-wounds heals 2d8+3", () => {
    const events = expectOk(
      run(world(caster(), hurt()), cast("cure-wounds"), [4, 5]).result,
    );
    expect(
      events.find((e) => e.type === "dice.rolled" && e.expression === "2d8+3"),
    ).toBeTruthy();
    expect(events.find((e) => e.type === "hp.changed")).toMatchObject({
      amount: 12,
      cause: "healing",
    });
  });

  it("cure-wounds at slot 2 heals 4d8+3", () => {
    const state = world(
      caster({
        spellSlots: { standard: { "2": { max: 1, expended: 0 } }, pact: null },
      }),
      hurt(),
    );
    const events = expectOk(
      run(state, cast("cure-wounds", { slotLevel: 2 }), [1, 1, 1, 1]).result,
    );
    expect(events[1]).toMatchObject({ expression: "4d8+3" });
  });

  it("cure-wounds wakes a 0 HP target", () => {
    const down = foe({
      hp: { current: 0, max: 40, temp: 0 },
      lifeState: "unconscious",
    });
    const state = settle(
      world(caster(), down),
      run(world(caster(), down), cast("cure-wounds"), [3, 3]).result,
    );
    expect(state.combatants["m-goblin"]?.lifeState).toBe("conscious");
    expect(state.combatants["m-goblin"]?.hp.current).toBe(9);
  });

  it("healing-word heals 2d4+3", () => {
    const events = expectOk(
      run(world(caster(), hurt()), cast("healing-word"), [2, 2]).result,
    );
    expect(events[1]).toMatchObject({ expression: "2d4+3" });
  });
});

describe("spell.cast refusals", () => {
  it("refuses unresolvable spells and slot levels", () => {
    expectRefusedBeforeDraw(
      run(world(), cast("bless", { slotLevel: 1 })),
      "SPELL_UNRESOLVED",
    );
    expectRefusedBeforeDraw(
      run(world(), cast("fire-bolt", { slotLevel: 1 })),
      "SPELL_UNRESOLVED",
    );
    expectRefusedBeforeDraw(
      run(world(), cast("cure-wounds", { slotLevel: null })),
      "SPELL_UNRESOLVED",
    );
  });

  it("refuses a slot level of 0 as an invalid command", () => {
    expectRefusedBeforeDraw(
      run(world(), cast("cure-wounds", { slotLevel: 0 })),
      "INVALID_COMMAND",
    );
  });

  it("refuses missing stats", () => {
    expectRefusedBeforeDraw(
      run(world(caster({ stats: stats(null) })), cast("fire-bolt")),
      "STAT_UNDEFINED",
    );
    expectRefusedBeforeDraw(
      run(world(caster(), foe({ stats: undefined })), cast("sacred-flame")),
      "STAT_UNDEFINED",
    );
  });

  it("refuses an unconscious caster, a dead target and unknown ids", () => {
    expectRefusedBeforeDraw(
      run(
        world(
          caster({
            lifeState: "unconscious",
            hp: { current: 0, max: 12, temp: 0 },
          }),
        ),
        cast("fire-bolt"),
      ),
      "ACTOR_UNABLE",
    );
    expectRefusedBeforeDraw(
      run(world(caster(), foe({ lifeState: "dead" })), cast("fire-bolt")),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(world(), cast("fire-bolt", { targetId: "m-nobody" })),
      "UNKNOWN_COMBATANT",
    );
  });
});

describe("spell.cast slots", () => {
  it("a leveled cast's first event spends the slot", () => {
    const out = run(world(), cast("inflict-wounds"), [18, 1, 1]);
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "spell-slots.changed",
      before: { pool: "standard", level: 1, expended: 0 },
      after: { pool: "standard", level: 1, expended: 1 },
    });
  });

  it("refuses NO_SLOT_AVAILABLE before any draw when every slot is spent", () => {
    const spent = caster({
      spellSlots: { standard: { "1": { max: 2, expended: 2 } }, pact: null },
    });
    expectRefusedBeforeDraw(
      run(world(spent), cast("cure-wounds")),
      "NO_SLOT_AVAILABLE",
    );
  });

  it("refuses SLOT_LEVEL_UNAVAILABLE with no slot of the level", () => {
    expectRefusedBeforeDraw(
      run(
        world(caster({ spellSlots: { standard: {}, pact: null } })),
        cast("cure-wounds"),
      ),
      "SLOT_LEVEL_UNAVAILABLE",
    );
  });

  it("a pact caster spends the pact slot", () => {
    const pact = caster({
      spellSlots: {
        standard: {},
        pact: { level: 1, slot: { max: 1, expended: 0 } },
      },
    });
    const events = expectOk(
      run(world(pact), cast("inflict-wounds"), [18, 1, 1]).result,
    );
    expect(events[0]).toMatchObject({
      after: { pool: "pact", level: 1, expended: 1 },
    });
  });
});

describe("spell table", () => {
  it("scales dice by caster level and slot level", () => {
    const fb = SPELLS["fire-bolt"] as NonNullable<(typeof SPELLS)[string]>;
    expect(spellDice(fb, null, 17).damage).toEqual(["4d10"]);
    const cw = SPELLS["cure-wounds"] as NonNullable<(typeof SPELLS)[string]>;
    expect(spellDice(cw, 3, 1).healing).toBe("6d8");
  });
});
