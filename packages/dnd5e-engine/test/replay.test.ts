import { describe, expect, it } from "vitest";
import {
  type EngineEvent,
  type EngineState,
  emptyState,
  execute,
  replay,
  scriptedRng,
} from "../src/index.js";
import { expectOk } from "./helpers.js";

const add = (combatant: Record<string, unknown>) => ({
  type: "combatant.add",
  combatant,
  reason: "scene seed",
});

describe("replay scene", () => {
  it("replays a scripted mini-scene to the threaded state", () => {
    // Faces in draw order: initiative 15/10/5; attack 20; crit damage 4d6;
    // save 11; death save 5; hit die 6.
    const rng = scriptedRng([15, 10, 5, 20, 3, 4, 5, 6, 11, 5, 6]);
    let state: EngineState = emptyState();
    const all: EngineEvent[] = [];
    const step = (command: unknown): EngineEvent[] => {
      const events = expectOk(execute(state, command, rng));
      all.push(...events);
      state = replay(events, state);
      return events;
    };

    step(
      add({
        id: "hero",
        name: "Hero",
        hp: { max: 12 },
        zeroHpRule: "death-saves",
        conModifier: 2,
        ac: 15,
        hitDice: [{ die: 10, total: 2 }],
        spellSlots: { standard: { "1": 2 }, pact: null },
      }),
    );
    step(
      add({
        id: "orc",
        name: "Orc",
        hp: { max: 20 },
        zeroHpRule: "dies",
        ac: 13,
        defenses: {
          resistances: ["slashing"],
          vulnerabilities: [],
          immunities: [],
        },
      }),
    );
    step(
      add({
        id: "imp",
        name: "Imp",
        hp: { max: 10 },
        zeroHpRule: "dies",
        ac: 12,
      }),
    );
    step({
      type: "initiative.roll",
      participants: ["hero", "orc", "imp"].map((combatantId) => ({
        combatantId,
        mode: "normal",
      })),
      reason: "combat begins",
    });
    const attack = step({
      type: "attack.roll",
      attackerId: "hero",
      targetId: "orc",
      expression: "1d20+5",
      mode: "normal",
      targetAc: null,
      reason: "sword",
    });
    expect(attack.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
    step({
      type: "damage.apply",
      targetId: "orc",
      critical: true,
      components: [
        {
          amount: { kind: "roll", expression: "2d6+3" },
          damageType: "slashing",
        },
      ],
      reason: "critical sword hit",
    });
    expect(state.combatants.orc?.hp.current).toBe(10);
    step({
      type: "check.roll",
      combatantId: "imp",
      kind: "saving-throw",
      ability: "dex",
      skill: null,
      expression: "1d20+1",
      mode: "normal",
      dc: 13,
      reason: "fire burst",
    });
    step({
      type: "condition.apply",
      targetId: "orc",
      condition: "poisoned",
      source: "imp sting",
      expiresAt: { round: 1, combatantId: "orc", boundary: "turn-end" },
      reason: "sting",
    });
    for (let i = 0; i < 3; i += 1) {
      step({ type: "turn.advance", reason: "next turn" });
    }
    expect(state.encounter?.round).toBe(2);
    expect(state.combatants.orc?.conditions).toEqual([]);
    step({
      type: "damage.apply",
      targetId: "hero",
      critical: false,
      components: [
        { amount: { kind: "fixed", value: 12 }, damageType: "piercing" },
      ],
      reason: "ambush",
    });
    step({
      type: "death-save.roll",
      targetId: "hero",
      mode: "normal",
      reason: "dying",
    });
    step({ type: "encounter.end", reason: "combat over" });
    step({
      type: "rest.short",
      participants: [{ combatantId: "hero", spend: [{ die: 10, count: 1 }] }],
      reason: "an hour by the fire",
    });
    expect(state.combatants.hero?.hp.current).toBe(8);
    step({
      type: "spell-slot.expend",
      targetId: "hero",
      pool: "standard",
      level: 1,
      reason: "cast",
    });
    step({
      type: "spell-slot.restore",
      targetId: "hero",
      pool: "standard",
      level: 1,
      count: 1,
      reason: "recovery",
    });

    expect(replay(all, emptyState())).toEqual(state);
    expect(rng.remaining()).toBe(0);
  });
});

describe("assist replay (spec 084)", () => {
  it("an assist survives replay and its end removes it", () => {
    const rng = scriptedRng([]);
    const mk = (id: string) => ({
      id,
      name: id,
      hp: { max: 10 },
      zeroHpRule: "death-saves",
      stats: {
        abilityMods: {},
        proficiencyBonus: 2,
        saves: {},
        skills: { athletics: 5 },
        attacks: [],
        spellcastingAbility: null,
      },
    });
    let state: EngineState = emptyState();
    const all: EngineEvent[] = [];
    for (const c of ["h", "a"]) {
      const events = expectOk(execute(state, add(mk(c)), rng));
      all.push(...events);
      state = replay(events, state);
    }
    const granted = expectOk(
      execute(
        state,
        {
          type: "help.grant",
          helperId: "h",
          assist: { kind: "ability-check", allyId: "a", skill: "athletics" },
          reason: "helps",
        },
        rng,
      ),
    );
    all.push(...granted);
    expect(replay(all).combatants.a?.assists).toHaveLength(1);
    const before = granted[0];
    if (before?.type !== "assist.granted") throw new Error("no grant");
    all.push({
      type: "assist.ended",
      v: 1,
      reason: "used",
      combatantId: "a",
      cause: "used",
      before: before.after,
      after: null,
    });
    expect(replay(all).combatants.a?.assists).toEqual([]);
  });
});

describe("replay of spatial events", () => {
  it("replays space.defined, combatant.placed and combatant.moved", () => {
    const rng = scriptedRng([]);
    let state: EngineState = emptyState();
    const all: EngineEvent[] = [];
    const step = (command: unknown) => {
      const events = expectOk(execute(state, command, rng));
      all.push(...events);
      state = replay(events, state);
    };
    const z = (id: string) => ({
      id,
      name: id,
      kind: "room",
      tags: [],
      hidden: false,
    });
    step(
      add({ id: "hero", name: "Hero", hp: { max: 12 }, zeroHpRule: "dies" }),
    );
    step({
      type: "space.define",
      space: {
        zones: [z("a"), z("b")],
        edges: [{ from: "a", to: "b", kind: "open", feet: 10 }],
      },
      reason: "scene",
    });
    step({
      type: "combatant.place",
      combatantId: "hero",
      zoneId: "a",
      reason: "p",
    });
    step({ type: "move", combatantId: "hero", toZoneId: "b", reason: "m" });
    expect(all.map((e) => e.type)).toEqual([
      "combatant.added",
      "space.defined",
      "combatant.placed",
      "combatant.moved",
    ]);
    expect(state.combatants.hero?.placement).toEqual({ zoneId: "b" });
    expect(replay(all)).toEqual(state);
    step({
      type: "combatant.place",
      combatantId: "hero",
      zoneId: null,
      reason: "gone",
    });
    expect(state.combatants.hero?.placement).toBeUndefined();
  });
});
