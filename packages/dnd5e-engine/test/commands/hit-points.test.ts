import { describe, expect, it } from "vitest";
import { damageEvents } from "../../src/commands/hit-points.js";
import {
  type DamageType,
  type DefenseSet,
  type EngineEvent,
  scriptedRng,
} from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const none: DefenseSet = {
  resistances: [],
  vulnerabilities: [],
  immunities: [],
};

const fixed = (value: number, damageType: DamageType = "slashing") => ({
  amount: { kind: "fixed", value },
  damageType,
});
const rolled = (expression: string, damageType: DamageType = "slashing") => ({
  amount: { kind: "roll", expression },
  damageType,
});
const dmg = (components: unknown[], extra: Record<string, unknown> = {}) => ({
  type: "damage.apply",
  targetId: "pc-ana",
  components,
  reason: "hit",
  ...extra,
});
const zeroed = (over = {}) =>
  makeCombatant({
    hp: { current: 0, max: 12, temp: 0 },
    lifeState: "unconscious",
    conditions: [
      {
        instanceId: "pc-ana#1",
        condition: "unconscious",
        level: null,
        source: "hp-zero",
        expiresAt: null,
      },
    ],
    conditionSeq: 1,
    ...over,
  });

describe("damage.apply", () => {
  it("temp HP absorb first (10/5 takes 8 -> 7/0)", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 10, max: 12, temp: 5 } }),
    );
    const { result } = run(state, dmg([fixed(8)]));
    const events = expectOk(result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "hp.changed",
      cause: "damage",
      amount: 8,
      rawAmount: 8,
      defensesSource: "record",
      critical: false,
      before: { current: 10, temp: 5 },
      after: { current: 7, temp: 0 },
    });
    expect(settle(state, result).combatants["pc-ana"]?.hp).toEqual({
      current: 7,
      max: 12,
      temp: 0,
    });
  });

  it("logs two components with raw and applied", () => {
    const state = stateWith(makeCombatant());
    const { result, rng } = run(
      state,
      dmg([rolled("1d8+1"), fixed(2, "fire")]),
      [4],
    );
    const events = expectOk(result);
    expect(events.map((e) => e.type)).toEqual(["dice.rolled", "hp.changed"]);
    expect(events[1]).toMatchObject({
      amount: 7,
      rawAmount: 7,
      components: [
        {
          damageType: "slashing",
          raw: 5,
          applied: 5,
          adjustment: "none",
          rollIndex: 0,
        },
        {
          damageType: "fire",
          raw: 2,
          applied: 2,
          adjustment: "none",
          rollIndex: null,
        },
      ],
    });
    expect(events[0]).toMatchObject({
      purpose: "damage",
      combatantId: "pc-ana",
    });
    expect(rng.remaining()).toBe(0);
  });

  it("resistance halves (9 -> 4)", () => {
    const state = stateWith(
      makeCombatant({ defenses: { ...none, resistances: ["fire"] } }),
    );
    const { result } = run(state, dmg([fixed(9, "fire")]));
    expect(expectOk(result)[0]).toMatchObject({
      amount: 4,
      rawAmount: 9,
      components: [{ raw: 9, applied: 4, adjustment: "resisted" }],
    });
  });

  it("vulnerability doubles (5 -> 10)", () => {
    const state = stateWith(
      makeCombatant({ defenses: { ...none, vulnerabilities: ["cold"] } }),
    );
    const { result } = run(state, dmg([fixed(5, "cold")]));
    expect(expectOk(result)[0]).toMatchObject({
      amount: 10,
      components: [{ adjustment: "vulnerable" }],
    });
  });

  it("immunity yields 0 and adds no death-save failure at 0 HP", () => {
    const state = stateWith(
      zeroed({ defenses: { ...none, immunities: ["poison"] } }),
    );
    const { result } = run(state, dmg([fixed(9, "poison")]));
    const events = expectOk(result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      amount: 0,
      rawAmount: 9,
      components: [{ applied: 0, adjustment: "immune" }],
      before: { current: 0, temp: 0 },
      after: { current: 0, temp: 0 },
    });
  });

  it("immunity wins over resistance and vulnerability", () => {
    const state = stateWith(
      makeCombatant({
        defenses: {
          resistances: ["fire"],
          vulnerabilities: ["fire"],
          immunities: ["fire"],
        },
      }),
    );
    const { result } = run(state, dmg([fixed(8, "fire")]));
    expect(expectOk(result)[0]).toMatchObject({ amount: 0 });
  });

  it("resisted and vulnerable halves then doubles (7 -> 6)", () => {
    const state = stateWith(
      makeCombatant({
        defenses: { ...none, resistances: ["fire"], vulnerabilities: ["fire"] },
      }),
    );
    const { result } = run(state, dmg([fixed(7, "fire")]));
    expect(expectOk(result)[0]).toMatchObject({
      amount: 6,
      components: [
        { raw: 7, applied: 6, adjustment: "resisted-and-vulnerable" },
      ],
    });
  });

  it("the command defense set replaces the record's", () => {
    const state = stateWith(
      makeCombatant({ defenses: { ...none, resistances: ["fire"] } }),
    );
    const { result } = run(state, dmg([fixed(8, "fire")], { defenses: none }));
    expect(expectOk(result)[0]).toMatchObject({
      amount: 8,
      defensesSource: "command",
      components: [{ adjustment: "none" }],
    });
  });

  it("critical doubles dice but not modifiers (2d6+3 draws four d6)", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 40, max: 40, temp: 0 } }),
    );
    const { result, rng, counter } = run(
      state,
      dmg([rolled("2d6+3")], { critical: true }),
      [1, 2, 3, 4],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({
      critical: true,
      total: 13,
      expression: "2d6+3",
    });
    expect(events[1]).toMatchObject({ amount: 13, critical: true });
    expect(counter.draws()).toBe(4);
    expect(rng.remaining()).toBe(0);
  });

  it("a critical roll past the dice limit refuses with no draws", () => {
    const out = run(
      stateWith(makeCombatant()),
      dmg([fixed(1), rolled("60d6")], { critical: true }),
    );
    expectRefusedBeforeDraw(out, "DICE_LIMIT_EXCEEDED");
  });

  it("parses every component before any draw", () => {
    const out = run(
      stateWith(makeCombatant()),
      dmg([rolled("1d6"), rolled("garbage")]),
      [3],
    );
    expectRefusedBeforeDraw(out, "INVALID_DICE_EXPRESSION");
  });

  it("a rolled amount below 0 becomes 0 and still logs", () => {
    const state = stateWith(makeCombatant());
    const { result } = run(state, dmg([rolled("1d4-5")]), [2]);
    expect(expectOk(result)[0]).toMatchObject({
      type: "dice.rolled",
      total: -3,
    });
    expect(expectOk(result)[1]).toMatchObject({
      amount: 0,
      components: [{ raw: 0, applied: 0 }],
      before: { current: 12, temp: 0 },
      after: { current: 12, temp: 0 },
    });
  });

  it("zero fixed damage still logs", () => {
    const { result } = run(stateWith(makeCombatant()), dmg([fixed(0)]));
    expect(expectOk(result)).toHaveLength(1);
  });

  it("damage to 0 makes the target unconscious with an hp-zero condition", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 7, max: 12, temp: 0 } }),
    );
    const { result } = run(state, dmg([fixed(9)]));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
      "condition.applied",
    ]);
    const c = settle(state, result).combatants["pc-ana"];
    expect(c).toMatchObject({
      lifeState: "unconscious",
      conditionSeq: 1,
      conditions: [
        { instanceId: "pc-ana#1", condition: "unconscious", source: "hp-zero" },
      ],
    });
  });

  it("does not stack a second unconscious condition", () => {
    const state = stateWith(
      makeCombatant({
        hp: { current: 3, max: 12, temp: 0 },
        conditions: [
          {
            instanceId: "pc-ana#1",
            condition: "unconscious",
            level: null,
            source: "spell:sleep",
            expiresAt: null,
          },
        ],
        conditionSeq: 1,
      }),
    );
    const { result } = run(state, dmg([fixed(3)]));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
    ]);
  });

  it("the dies rule kills at 0", () => {
    const state = stateWith(
      makeCombatant({
        zeroHpRule: "dies",
        hp: { current: 5, max: 7, temp: 0 },
      }),
    );
    const { result } = run(state, dmg([fixed(5)]));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]?.lifeState).toBe("dead");
  });

  it("massive damage kills outright and uses the applied amount", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 4, max: 12, temp: 0 } }),
    );
    // 16 raw - 4 hp = 12 overflow >= max 12.
    const dead = run(state, dmg([fixed(16)]));
    expect(expectOk(dead.result)[1]).toMatchObject({ after: "dead" });
    // 16 raw halved to 8: overflow 4, survives.
    const resisted = stateWith(
      makeCombatant({
        hp: { current: 4, max: 12, temp: 0 },
        defenses: { ...none, resistances: ["slashing"] },
      }),
    );
    const alive = run(resisted, dmg([fixed(16)]));
    expect(expectOk(alive.result)[1]).toMatchObject({ after: "unconscious" });
  });

  it("damage at 0 HP adds one failure, two on a critical, the third kills", () => {
    const state = stateWith(zeroed());
    const one = run(state, dmg([fixed(2)]));
    expect(expectOk(one.result).map((e) => e.type)).toEqual([
      "hp.changed",
      "death-saves.changed",
    ]);
    expect(
      settle(state, one.result).combatants["pc-ana"]?.deathSaves.failures,
    ).toBe(1);
    const crit = run(state, dmg([fixed(2)], { critical: true }));
    expect(
      settle(state, crit.result).combatants["pc-ana"]?.deathSaves.failures,
    ).toBe(2);
    const third = stateWith(
      zeroed({ deathSaves: { successes: 1, failures: 2 } }),
    );
    const dead = run(third, dmg([fixed(2)]));
    expect(expectOk(dead.result).map((e) => e.type)).toEqual([
      "hp.changed",
      "death-saves.changed",
      "life-state.changed",
    ]);
    expect(settle(third, dead.result).combatants["pc-ana"]).toMatchObject({
      lifeState: "dead",
      deathSaves: { successes: 1, failures: 3 },
    });
  });

  it("damage at 0 HP of at least max kills", () => {
    const state = stateWith(zeroed());
    const { result } = run(state, dmg([fixed(12)]));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]?.lifeState).toBe("dead");
  });

  it("damage on a stable target wakes it and adds a failure", () => {
    const state = stateWith(zeroed({ lifeState: "stable" }));
    const { result } = run(state, dmg([fixed(2)]));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
      "death-saves.changed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]).toMatchObject({
      lifeState: "unconscious",
      deathSaves: { failures: 1 },
    });
  });

  it("refuses unknown and dead targets before any draw", () => {
    expectRefusedBeforeDraw(
      run(stateWith(), dmg([rolled("1d6")])),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(
          makeCombatant({
            lifeState: "dead",
            hp: { current: 0, max: 12, temp: 0 },
          }),
        ),
        dmg([rolled("1d6")]),
      ),
      "TARGET_DEAD",
    );
  });
});

const heal = (amount: unknown) => ({
  type: "healing.apply",
  targetId: "pc-ana",
  amount,
  reason: "cure wounds",
});

describe("healing.apply", () => {
  it("heals and caps at max", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 10, max: 12, temp: 2 } }),
    );
    const { result } = run(state, heal({ kind: "fixed", value: 9 }));
    const events = expectOk(result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      cause: "healing",
      amount: 9,
      before: { current: 10, temp: 2 },
      after: { current: 12, temp: 2 },
    });
  });

  it("rolls the amount and links the roll", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 4, max: 12, temp: 0 } }),
    );
    const { result, rng } = run(
      state,
      heal({ kind: "roll", expression: "2d4+2" }),
      [3, 4],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({ purpose: "healing", total: 9 });
    expect(events[1]).toMatchObject({
      amount: 9,
      rollIndex: 0,
      after: { current: 12 },
    });
    expect(rng.remaining()).toBe(0);
  });

  it("a negative roll heals 0 and still logs", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 4, max: 12, temp: 0 } }),
    );
    const { result } = run(
      state,
      heal({ kind: "roll", expression: "1d4-5" }),
      [1],
    );
    expect(expectOk(result)[1]).toMatchObject({
      amount: 0,
      before: { current: 4 },
      after: { current: 4 },
    });
  });

  it("healing at 0 wakes the target, resets the tally and removes hp-zero", () => {
    const state = stateWith(
      zeroed({ deathSaves: { successes: 1, failures: 2 } }),
    );
    const { result } = run(state, heal({ kind: "fixed", value: 3 }));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
      "death-saves.changed",
      "condition.removed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]).toMatchObject({
      lifeState: "conscious",
      hp: { current: 3 },
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    });
  });

  it("keeps a spell-sourced unconscious condition", () => {
    const sleep = {
      instanceId: "pc-ana#2",
      condition: "unconscious" as const,
      level: null,
      source: "spell:sleep",
      expiresAt: null,
    };
    const base = zeroed();
    const state = stateWith(
      zeroed({ conditions: [...base.conditions, sleep], conditionSeq: 2 }),
    );
    const { result } = run(state, heal({ kind: "fixed", value: 1 }));
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "hp.changed",
      "life-state.changed",
      "condition.removed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]?.conditions).toEqual([
      sleep,
    ]);
  });

  it("zero healing at 0 HP does not wake the target", () => {
    const state = stateWith(zeroed());
    const { result } = run(state, heal({ kind: "fixed", value: 0 }));
    expect(expectOk(result).map((e) => e.type)).toEqual(["hp.changed"]);
  });

  it("refuses dead, unknown and bad expressions before any draw", () => {
    const dead = makeCombatant({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusedBeforeDraw(
      run(stateWith(dead), heal({ kind: "fixed", value: 3 })),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(stateWith(), heal({ kind: "fixed", value: 3 })),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), heal({ kind: "roll", expression: "d" })),
      "INVALID_DICE_EXPRESSION",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(makeCombatant()),
        heal({ kind: "roll", expression: "101d6" }),
      ),
      "DICE_LIMIT_EXCEEDED",
    );
  });
});

const temp = (amount: unknown) => ({
  type: "temp-hp.grant",
  targetId: "pc-ana",
  amount,
  reason: "false life",
});

describe("temp-hp.grant", () => {
  it("a higher fixed grant replaces the current value", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 12, max: 12, temp: 3 } }),
    );
    const { result } = run(state, temp({ kind: "fixed", value: 8 }));
    expect(expectOk(result)[0]).toMatchObject({
      cause: "temp-hp",
      amount: 8,
      before: { current: 12, temp: 3 },
      after: { current: 12, temp: 8 },
    });
    expect(settle(state, result).combatants["pc-ana"]?.hp.temp).toBe(8);
  });

  it("a rolled grant higher than current replaces it", () => {
    const state = stateWith(makeCombatant());
    const { result } = run(
      state,
      temp({ kind: "roll", expression: "1d4+4" }),
      [3],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({ purpose: "temp-hp" });
    expect(events[1]).toMatchObject({
      amount: 7,
      rollIndex: 0,
      after: { temp: 7 },
    });
  });

  it("a rolled grant lower than current keeps the existing value", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 12, max: 12, temp: 9 } }),
    );
    const { result } = run(
      state,
      temp({ kind: "roll", expression: "1d4+1" }),
      [2],
    );
    expect(expectOk(result)[1]).toMatchObject({
      before: { current: 12, temp: 9 },
      after: { current: 12, temp: 9 },
    });
  });

  it("refuses a fixed grant that is not higher", () => {
    const state = stateWith(
      makeCombatant({ hp: { current: 12, max: 12, temp: 5 } }),
    );
    expectRefusedBeforeDraw(
      run(state, temp({ kind: "fixed", value: 5 })),
      "TEMP_HP_NOT_HIGHER",
    );
    expectRefusedBeforeDraw(
      run(state, temp({ kind: "fixed", value: 2 })),
      "TEMP_HP_NOT_HIGHER",
    );
  });

  it("refuses dead, unknown and bad expressions before any draw", () => {
    const dead = makeCombatant({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusedBeforeDraw(
      run(stateWith(dead), temp({ kind: "fixed", value: 3 })),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(stateWith(), temp({ kind: "fixed", value: 3 })),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(makeCombatant()),
        temp({ kind: "roll", expression: "1d0" }),
      ),
      "INVALID_DICE_EXPRESSION",
    );
  });
});

describe("damage halving (spec 083)", () => {
  const halve = (defenses: DefenseSet, value: number) => {
    const target = makeCombatant({ defenses });
    const events: EngineEvent[] = [];
    const refusal = damageEvents(
      target,
      [fixed(value, "fire")] as never,
      { critical: false, half: true, reason: "x" },
      events,
      scriptedRng([]),
    );
    expect(refusal).toBeNull();
    return events[0];
  };
  it("an odd amount rounds down (9 -> 4)", () => {
    expect(halve(none, 9)).toMatchObject({
      amount: 4,
      rawAmount: 4,
      half: true,
    });
  });
  it("half then resistance (9 -> 4 -> 2)", () => {
    expect(halve({ ...none, resistances: ["fire"] }, 9)).toMatchObject({
      amount: 2,
      rawAmount: 4,
      half: true,
    });
  });
});
