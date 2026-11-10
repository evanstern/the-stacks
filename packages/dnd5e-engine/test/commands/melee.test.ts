import { describe, expect, it } from "vitest";
import {
  type AttackEntry,
  type Combatant,
  type EngineState,
  meleeFoes,
} from "../../src/index.js";
import { expectOk, makeCombatant, run, settle, stateWith } from "../helpers.js";

// SRD 5.2.1 playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat (spec 101)
const zone = (id: string) => ({
  id,
  name: id,
  kind: "room",
  tags: [],
  hidden: false,
});
const space = {
  zones: ["reed-camp", "camp-post"].map(zone),
  edges: [{ from: "reed-camp", to: "camp-post", kind: "open", feet: 5 }],
};
const entry = (
  name: string,
  range: "melee" | "ranged",
  rangeFt?: { normal: number; long: number },
): AttackEntry => ({
  name,
  range,
  toHit: 5,
  damage: [],
  ...(rangeFt ? { rangeFt } : {}),
});
const stats = (attacks: AttackEntry[], spellcastingAbility: "wis" | null) => ({
  abilityMods: { wis: 3 },
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks,
  spellcastingAbility,
});
const kestrel = makeCombatant({
  id: "kestrel",
  name: "Kestrel",
  side: "party",
  speed: 30,
  ac: 14,
  stats: stats(
    [
      entry("Shortbow", "ranged", { normal: 80, long: 320 }),
      entry("Dagger", "melee"),
    ],
    "wis",
  ),
});
const goblin = (n: number) =>
  makeCombatant({
    id: `goblin-${n}`,
    name: `Goblin ${n}`,
    side: "hostile",
    speed: 30,
    ac: 15,
    stats: stats([entry("Scimitar", "melee")], null),
  });

/** Kestrel acts first; she and two goblins stand in reed-camp; no melee pair yet. */
function scene(): EngineState {
  const base = stateWith(kestrel, goblin(1), goblin(2));
  let state = settle(
    base,
    run(base, { type: "space.define", space, reason: "scene" }).result,
  );
  for (const id of ["kestrel", "goblin-1", "goblin-2"]) {
    state = settle(
      state,
      run(state, {
        type: "combatant.place",
        combatantId: id,
        zoneId: "reed-camp",
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
        participants: ["kestrel", "goblin-1", "goblin-2"].map(
          (combatantId) => ({
            combatantId,
            mode: "normal",
          }),
        ),
        reason: "combat",
      },
      [18, 10, 9],
    ).result,
  );
}

const swing = (attackerId: string, targetId: string, attack: string) => ({
  type: "attack.roll",
  attackerId,
  targetId,
  attack,
  reason: "swing",
});
const shoot = swing("kestrel", "goblin-2", "Shortbow");
const modeOf = (state: EngineState, cmd: unknown, faces: number[]) => {
  const out = run(state, cmd, faces);
  return { first: expectOk(out.result)[0], draws: out.counter.draws() };
};
const step = (state: EngineState, cmd: unknown, faces: number[] = []) =>
  settle(state, run(state, cmd, faces).result);
const paired = () =>
  step(scene(), swing("goblin-1", "kestrel", "Scimitar"), [15]);

describe("melee pairs (spec 101)", () => {
  it("US1.1: no pair, same zone: the shot is normal, one d20", () => {
    expect(modeOf(scene(), shoot, [15])).toMatchObject({
      first: { mode: "normal", natural: 15 },
      draws: 1,
    });
  });

  it("US1.2: a ranged spell attack with no pair is normal", () => {
    const out = modeOf(
      scene(),
      {
        type: "spell.cast",
        casterId: "kestrel",
        spellId: "fire-bolt",
        targetId: "goblin-2",
        slotLevel: null,
        casterLevel: 1,
        reason: "bolt",
      },
      [15, 6],
    );
    expect(out.first).toMatchObject({ mode: "normal", natural: 15 });
  });

  it("US2.1: a goblin's melee attack records the pair", () => {
    const out = run(scene(), swing("goblin-1", "kestrel", "Scimitar"), [15]);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
      "encounter.changed",
    ]);
    expect(events[2]).toMatchObject({
      after: { melee: [["goblin-1", "kestrel"]] },
    });
  });

  it("US2.2: engaged, Kestrel shoots goblin-2 at disadvantage", () => {
    expect(modeOf(paired(), shoot, [15, 4])).toMatchObject({
      first: { mode: "disadvantage", natural: 4 },
      draws: 2,
    });
  });

  it("US2.3: Kestrel's own Dagger attack forms the pair", () => {
    const state = step(scene(), swing("kestrel", "goblin-1", "Dagger"), [3]);
    expect(meleeFoes(state, "kestrel")).toEqual(["goblin-1"]);
    expect(modeOf(state, shoot, [15, 4]).first).toMatchObject({
      mode: "disadvantage",
    });
  });

  it("US2.4: a ranged spell attack is at disadvantage while engaged", () => {
    const out = modeOf(
      paired(),
      {
        type: "spell.cast",
        casterId: "kestrel",
        spellId: "fire-bolt",
        targetId: "goblin-2",
        slotLevel: null,
        casterLevel: 1,
        reason: "bolt",
      },
      [15, 3, 6],
    );
    expect(out.first).toMatchObject({ mode: "disadvantage", natural: 3 });
  });

  it("US2.5: an opportunity attack puts the pair and the spent Reaction in one event", () => {
    const events = expectOk(
      run(
        scene(),
        { ...swing("goblin-1", "kestrel", "Scimitar"), reaction: true },
        [15],
      ).result,
    );
    const changed = events.filter((e) => e.type === "encounter.changed");
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      after: {
        reactionsSpent: ["goblin-1"],
        melee: [["goblin-1", "kestrel"]],
      },
    });
  });

  it("US2.6: an existing pair emits no second encounter.changed", () => {
    const events = expectOk(
      run(paired(), swing("goblin-1", "kestrel", "Scimitar"), [15]).result,
    );
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
  });

  it("US3.1: moving to camp-post drops the pair; the next shot is normal", () => {
    const state = step(paired(), {
      type: "move",
      combatantId: "kestrel",
      toZoneId: "camp-post",
      reason: "step back",
    });
    expect(state.encounter?.melee).toEqual([]);
    expect(modeOf(state, shoot, [15])).toMatchObject({
      first: { mode: "normal" },
      draws: 1,
    });
  });

  it("US3.2: Disengage then move to another zone: the ranged attack has no disadvantage", () => {
    let state = step(paired(), {
      type: "movement.action",
      combatantId: "kestrel",
      action: "disengage",
      reason: "disengage",
    });
    expect(meleeFoes(state, "kestrel")).toEqual(["goblin-1"]);
    state = step(state, {
      type: "move",
      combatantId: "kestrel",
      toZoneId: "camp-post",
      reason: "withdraw",
    });
    expect(meleeFoes(state, "kestrel")).toEqual([]);
    expect(modeOf(state, shoot, [15])).toMatchObject({
      first: { mode: "normal", natural: 15 },
      draws: 1,
    });
  });

  it("US3.3: Disengage and stay: the pair holds, disadvantage", () => {
    const state = step(paired(), {
      type: "movement.action",
      combatantId: "kestrel",
      action: "disengage",
      reason: "disengage",
    });
    expect(modeOf(state, shoot, [15, 4]).first).toMatchObject({
      mode: "disadvantage",
    });
  });

  it("US3.4: a downed or incapacitated foe stops the penalty; the pair stays", () => {
    const base = paired();
    const down = {
      ...base,
      combatants: {
        ...base.combatants,
        "goblin-1": {
          ...(base.combatants["goblin-1"] as Combatant),
          lifeState: "unconscious" as const,
          hp: { current: 0, max: 7, temp: 0 },
        },
      },
    } as EngineState;
    expect(modeOf(down, shoot, [15]).first).toMatchObject({ mode: "normal" });
    expect(down.encounter?.melee).toEqual([["goblin-1", "kestrel"]]);
  });

  it("US3.5: re-place, leave and depart each end the pair", () => {
    const replaced = step(paired(), {
      type: "combatant.place",
      combatantId: "goblin-1",
      zoneId: "camp-post",
      reason: "shoved",
    });
    expect(replaced.encounter?.melee).toEqual([]);
    const left = step(paired(), {
      type: "initiative.leave",
      combatantId: "goblin-1",
      reason: "flees",
    });
    expect(left.encounter?.melee).toEqual([]);
    const departed = step(paired(), {
      type: "combatant.depart",
      combatantId: "goblin-1",
      reason: "gone",
    });
    expect(departed.encounter?.melee).toEqual([]);
  });

  it("US3.6: the encounter's end clears every pair", () => {
    const state = step(paired(), { type: "encounter.end", reason: "over" });
    expect(state.encounter).toBeNull();
    expect(meleeFoes(state, "kestrel")).toEqual([]);
  });

  it("US3.7: a full round of turns keeps the pair", () => {
    let state = paired();
    for (let i = 0; i < 3; i += 1) {
      state = step(state, { type: "turn.advance", reason: "next" });
    }
    expect(meleeFoes(state, "kestrel")).toEqual(["goblin-1"]);
  });

  it("outside an encounter no pair forms and the shot is normal (OQ-3)", () => {
    const free = { ...scene(), encounter: null };
    const events = expectOk(
      run(free, swing("goblin-1", "kestrel", "Scimitar"), [15]).result,
    );
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
    expect(modeOf(free, shoot, [15]).first).toMatchObject({ mode: "normal" });
  });
});
