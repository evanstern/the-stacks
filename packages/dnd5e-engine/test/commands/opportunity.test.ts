import { describe, expect, it } from "vitest";
import {
  type AttackEntry,
  type CombatantStats,
  type EngineState,
  provokers,
} from "../../src/index.js";
import {
  expectOk,
  expectRefusal,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const zone = (id: string) => ({
  id,
  name: id,
  kind: "room",
  tags: [],
  hidden: false,
});
const space = {
  zones: ["a", "b"].map(zone),
  edges: [{ from: "a", to: "b", kind: "open", feet: 20 }],
};
const sword: AttackEntry = {
  name: "Scimitar",
  range: "melee",
  toHit: 5,
  damage: [],
};
const bow: AttackEntry = {
  name: "Bow",
  range: "ranged",
  toHit: 5,
  damage: [],
  rangeFt: { normal: 80, long: 320 },
};
const stats = (attacks: AttackEntry[]): CombatantStats => ({
  abilityMods: {},
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks,
  spellcastingAbility: null,
});

const fighter = (o = {}) =>
  makeCombatant({
    id: "fighter",
    name: "Fighter",
    speed: 30,
    hp: { current: 3, max: 12, temp: 0 },
    ...o,
  });
const goblin = (o = {}) =>
  makeCombatant({
    id: "goblin",
    name: "Goblin",
    speed: 30,
    stats: stats([sword]),
    ...o,
  });

/** The fighter acts first (18 vs 10); both stand in zone `a` unless the goblin is overridden. */
function scene(goblinZone = "a", goblinOver = {}): EngineState {
  const base = stateWith(fighter(), goblin(goblinOver));
  let state = settle(
    base,
    run(base, { type: "space.define", space, reason: "scene" }).result,
  );
  for (const [id, z] of [
    ["fighter", "a"],
    ["goblin", goblinZone],
  ]) {
    state = settle(
      state,
      run(state, {
        type: "combatant.place",
        combatantId: id,
        zoneId: z,
        reason: "placed",
      }).result,
    );
  }
  return settle(
    state,
    run(
      state,
      {
        type: "initiative.roll",
        participants: [
          { combatantId: "fighter", mode: "normal" },
          { combatantId: "goblin", mode: "normal" },
        ],
        reason: "combat",
      },
      [18, 10],
    ).result,
  );
}

const disengage = {
  type: "movement.action",
  combatantId: "fighter",
  action: "disengage",
  reason: "disengage",
};
const moveToB = {
  type: "move",
  combatantId: "fighter",
  toZoneId: "b",
  reason: "flees",
};
const strike = {
  type: "attack.roll",
  attackerId: "goblin",
  targetId: "fighter",
  attack: "Scimitar",
  reaction: true,
  reason: "opportunity attack",
};

describe("opportunity attacks (spec 094 US3)", () => {
  it("US3.1: provokers names the goblin in the origin zone", () => {
    expect(provokers(scene(), "fighter", "b")).toEqual(["goblin"]);
  });

  it("US3.2: hit [15], damage, then the fighter's move; the Reaction is spent", () => {
    let state = scene();
    const hit = run(state, strike, [15]);
    expect(expectOk(hit.result).map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
      "encounter.changed",
    ]);
    expect(expectOk(hit.result)[1]).toMatchObject({
      outcome: "hit",
      total: 20,
      reaction: true,
    });
    state = settle(state, hit.result);
    expect(state.encounter?.reactionsSpent).toEqual(["goblin"]);
    const dmg = run(state, {
      type: "damage.apply",
      targetId: "fighter",
      components: [
        { amount: { kind: "fixed", value: 2 }, damageType: "slashing" },
      ],
      reason: "hit",
    });
    state = settle(state, dmg.result);
    expect(state.combatants.fighter?.hp.current).toBe(1);
    const mv = run(state, moveToB);
    expect(expectOk(mv.result).map((e) => e.type)).toEqual([
      "combatant.moved",
      "encounter.changed",
    ]);
    state = settle(state, mv.result);
    expect(state.combatants.fighter?.placement).toEqual({ zoneId: "b" });
    expect(provokers(state, "goblin", "b")).toEqual([]);
  });

  it("a miss [3] leaves the fighter's move open", () => {
    let state = scene();
    const miss = run(state, strike, [3]);
    expect(expectOk(miss.result)[1]).toMatchObject({ outcome: "miss" });
    state = settle(state, miss.result);
    expectOk(run(state, moveToB).result);
  });

  it("US3.3: Disengage empties provokers", () => {
    const state = scene();
    const next = settle(state, run(state, disengage).result);
    expect(provokers(next, "fighter", "b")).toEqual([]);
  });

  it("US3.4: omits a spent Reaction, an incapacitated goblin, no melee entry, another zone", () => {
    const state = scene();
    const spent = settle(state, run(state, strike, [3]).result);
    expect(provokers(spent, "fighter", "b")).toEqual([]);
    const stunned = scene("a", {
      conditions: [
        {
          instanceId: "c1",
          condition: "incapacitated",
          level: null,
          source: "spell",
          expiresAt: null,
        },
      ],
      conditionSeq: 1,
    });
    expect(provokers(stunned, "fighter", "b")).toEqual([]);
    expect(
      provokers(scene("a", { stats: stats([bow]) }), "fighter", "b"),
    ).toEqual([]);
    expect(provokers(scene("b"), "fighter", "b")).toEqual([]);
  });

  it("US3.5: a reaction hit that drops the fighter to 0 HP refuses the move", () => {
    let state = scene();
    state = settle(state, run(state, strike, [15]).result);
    state = settle(
      state,
      run(state, {
        type: "damage.apply",
        targetId: "fighter",
        components: [
          { amount: { kind: "fixed", value: 5 }, damageType: "slashing" },
        ],
        reason: "hit",
      }).result,
    );
    const out = run(state, moveToB);
    expectRefusal(out.result, "ACTOR_UNABLE");
    expect(state.combatants.fighter?.placement).toEqual({ zoneId: "a" });
  });
});
