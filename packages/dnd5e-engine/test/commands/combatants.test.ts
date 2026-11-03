import { describe, expect, it } from "vitest";
import {
  expectOk,
  expectRefusal,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const add = (combatant: Record<string, unknown>) => ({
  type: "combatant.add",
  combatant,
  reason: "scene setup",
});

describe("combatant.add", () => {
  it("fills defaults from a minimal init", () => {
    const state = stateWith();
    const { result } = run(
      state,
      add({ id: "gob-1", name: "Goblin", hp: { max: 7 }, zeroHpRule: "dies" }),
    );
    const [event] = expectOk(result);
    expect(event).toMatchObject({ type: "combatant.added", before: null });
    const c = settle(state, result).combatants["gob-1"];
    expect(c).toMatchObject({
      hp: { current: 7, max: 7, temp: 0 },
      lifeState: "conscious",
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      conditionSeq: 0,
      hitDice: [],
      spellSlots: { standard: {}, pact: null },
      initiativeBonus: 0,
      conModifier: 0,
      ac: null,
      defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    });
  });

  it("carries ac, defenses, hit dice and slots", () => {
    const state = stateWith();
    const { result } = run(
      state,
      add({
        id: "pc-bo",
        name: "Bo",
        hp: { max: 20, current: 15, temp: 3 },
        zeroHpRule: "death-saves",
        ac: 17,
        defenses: {
          resistances: ["fire"],
          vulnerabilities: [],
          immunities: ["poison"],
        },
        hitDice: [
          { die: 8, total: 3, remaining: 2 },
          { die: 10, total: 1 },
        ],
        spellSlots: {
          standard: { "1": 4, "2": 2 },
          pact: { level: 2, count: 2 },
        },
      }),
    );
    const c = settle(state, result).combatants["pc-bo"];
    expect(c).toMatchObject({
      hp: { current: 15, max: 20, temp: 3 },
      ac: 17,
      defenses: { resistances: ["fire"], immunities: ["poison"] },
      hitDice: [
        { die: 8, total: 3, remaining: 2 },
        { die: 10, total: 1, remaining: 1 },
      ],
      spellSlots: {
        standard: {
          "1": { max: 4, expended: 0 },
          "2": { max: 2, expended: 0 },
        },
        pact: { level: 2, slot: { max: 2, expended: 0 } },
      },
    });
  });

  it("starts unconscious at 0 HP under the death-saves rule", () => {
    const state = stateWith();
    const { result } = run(
      state,
      add({
        id: "pc-bo",
        name: "Bo",
        hp: { max: 10, current: 0 },
        zeroHpRule: "death-saves",
      }),
    );
    expect(settle(state, result).combatants["pc-bo"]?.lifeState).toBe(
      "unconscious",
    );
  });

  it("starts dead at 0 HP under the dies rule", () => {
    const state = stateWith();
    const { result } = run(
      state,
      add({
        id: "gob-1",
        name: "Goblin",
        hp: { max: 7, current: 0 },
        zeroHpRule: "dies",
      }),
    );
    expect(settle(state, result).combatants["gob-1"]?.lifeState).toBe("dead");
  });

  it("refuses a duplicate id", () => {
    const { result, counter } = run(
      stateWith(makeCombatant()),
      add({ id: "pc-ana", name: "Ana", hp: { max: 5 }, zeroHpRule: "dies" }),
    );
    expectRefusal(result, "DUPLICATE_COMBATANT");
    expect(counter.draws()).toBe(0);
  });
});

describe("combatant.remove", () => {
  it("removes a combatant", () => {
    const state = stateWith(makeCombatant());
    const { result } = run(state, {
      type: "combatant.remove",
      combatantId: "pc-ana",
      reason: "left the scene",
    });
    expect(expectOk(result)[0]).toMatchObject({ type: "combatant.removed" });
    expect(settle(state, result).combatants).toEqual({});
  });

  it("refuses an unknown id", () => {
    const { result } = run(stateWith(), {
      type: "combatant.remove",
      combatantId: "nobody",
      reason: "x",
    });
    expectRefusal(result, "UNKNOWN_COMBATANT");
  });

  it("refuses to remove a combatant in the active encounter", () => {
    const base = stateWith(makeCombatant());
    const started = settle(
      base,
      run(
        base,
        {
          type: "initiative.roll",
          participants: [{ combatantId: "pc-ana", mode: "normal" }],
          reason: "combat begins",
        },
        [10],
      ).result,
    );
    expectRefusedBeforeDraw(
      run(started, {
        type: "combatant.remove",
        combatantId: "pc-ana",
        reason: "x",
      }),
      "COMBATANT_IN_ENCOUNTER",
    );
  });

  it("refuses an unknown target on other commands too", () => {
    const { result } = run(stateWith(), {
      type: "healing.apply",
      targetId: "nobody",
      amount: { kind: "fixed", value: 1 },
      reason: "x",
    });
    expectRefusal(result, "UNKNOWN_COMBATANT");
  });
});

describe("combatant.add stats (spec 082)", () => {
  it("copies stats when present and parses without them", () => {
    const stats = {
      abilityMods: { str: 3 },
      proficiencyBonus: 2,
      saves: {},
      skills: {},
      attacks: [],
      spellcastingAbility: null,
    };
    const state = stateWith();
    const withStats = run(
      state,
      add({ id: "a", name: "A", hp: { max: 5 }, zeroHpRule: "dies", stats }),
    );
    expect(settle(state, withStats.result).combatants.a?.stats).toEqual(stats);
    const without = run(
      state,
      add({ id: "b", name: "B", hp: { max: 5 }, zeroHpRule: "dies" }),
    );
    expect(settle(state, without.result).combatants.b?.stats).toBeUndefined();
  });
});
