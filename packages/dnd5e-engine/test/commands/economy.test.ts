import { describe, expect, it } from "vitest";
import {
  actionsLeft,
  type Combatant,
  type EngineEvent,
  type EngineState,
  isDodging,
  replay,
  SPELLS,
} from "../../src/index.js";
import {
  expectOk,
  expectRefusal,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const stats = (over = {}) => ({
  abilityMods: { str: 3, dex: 2, con: 0, wis: 3 },
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks: [
    {
      name: "Sword",
      range: "melee" as const,
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
const roll = (ids: string[]) => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
  reason: "combat begins",
});
const advance = { type: "turn.advance", reason: "next turn" };
const spend = (combatantId: string, cost = "action") => ({
  type: "action.spend",
  combatantId,
  cost,
  reason: "acts",
});
const dodge = (combatantId: string) => ({
  type: "dodge",
  combatantId,
  reason: "dodges",
});
const attack = (attackerId: string, targetId: string, over = {}) => ({
  type: "attack.roll",
  attackerId,
  targetId,
  attack: "Sword",
  reason: "swing",
  ...over,
});

/** Order: a (15), b (10), c (5). a is active. */
function started(over: Record<string, Partial<Combatant>> = {}): EngineState {
  const state = stateWith(mk("a", over.a), mk("b", over.b), mk("c", over.c));
  return settle(state, run(state, roll(["a", "b", "c"]), [15, 10, 5]).result);
}
const play = (state: EngineState, command: unknown, faces: number[] = []) =>
  settle(state, run(state, command, faces).result);

describe("action.spend (spec 117)", () => {
  it("records an Action and a Bonus Action on the active turn", () => {
    const s0 = started();
    expect(actionsLeft(s0, "a")).toEqual({ action: true, bonusAction: true });
    const out = run(s0, spend("a"));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual(["encounter.changed"]);
    expect(events[0]).toMatchObject({ combatantId: "a" });
    const s1 = settle(s0, out.result);
    expect(s1.encounter?.economy).toEqual({
      combatantId: "a",
      round: 1,
      actionUsed: true,
      bonusActionUsed: false,
    });
    expect(actionsLeft(s1, "a")).toEqual({ action: false, bonusAction: true });
    const s2 = play(s1, spend("a", "bonus-action"));
    expect(actionsLeft(s2, "a")).toEqual({ action: false, bonusAction: false });
  });

  it("refuses a second Action before any draw and leaves the Bonus Action free", () => {
    const s1 = play(started(), spend("a"));
    expectRefusedBeforeDraw(run(s1, spend("a")), "ACTION_SPENT");
    expectOk(run(s1, spend("a", "bonus-action")).result);
    const s2 = play(s1, spend("a", "bonus-action"));
    expectRefusedBeforeDraw(
      run(s2, spend("a", "bonus-action")),
      "ACTION_SPENT",
    );
  });

  it("refuses off turn, with no encounter, for an unknown id and when unable", () => {
    expectRefusedBeforeDraw(run(started(), spend("b")), "MOVE_OFF_TURN");
    expectRefusedBeforeDraw(
      run(stateWith(mk("a")), spend("a")),
      "NO_ACTIVE_ENCOUNTER",
    );
    expectRefusedBeforeDraw(run(started(), spend("zz")), "UNKNOWN_COMBATANT");
    expectRefusedBeforeDraw(
      run(
        started({ a: { conditions: [cond("incapacitated")] as never } }),
        spend("a"),
      ),
      "ACTOR_UNABLE",
    );
  });

  it("resets at the spender's next turn and replays to the same state", () => {
    const s0 = started();
    const out = run(s0, spend("a"));
    const events: EngineEvent[] = expectOk(out.result);
    const s1 = settle(s0, out.result);
    expect(replay(events, s0)).toEqual(s1);
    // a -> b -> c -> a (round 2)
    const s4 = play(play(play(s1, advance), advance), advance);
    expect(s4.encounter?.round).toBe(2);
    expect(actionsLeft(s4, "a")).toEqual({ action: true, bonusAction: true });
    expectOk(run(s4, spend("a")).result);
    // Another combatant's turn never reads a's record.
    expect(actionsLeft(play(s1, advance), "a")).toEqual({
      action: true,
      bonusAction: true,
    });
  });

  it("actionsLeft is null outside an encounter or for an id not in the order", () => {
    expect(actionsLeft(stateWith(mk("a")), "a")).toBeNull();
    expect(actionsLeft(started(), "zz")).toBeNull();
  });
});

describe("dodge (spec 117)", () => {
  /** b dodges on its own turn, then c, then a. a is active and attacks b. */
  function dodged(over: Record<string, Partial<Combatant>> = {}) {
    const s = play(play(started(over), advance), dodge("b"));
    return play(play(s, advance), advance); // c, then a (round 2)
  }

  it("adds the dodger once and spends nothing", () => {
    const s0 = play(started(), dodge("a"));
    expect(s0.encounter?.dodging).toEqual(["a"]);
    expect(s0.encounter?.economy).toBeUndefined();
    expect(play(s0, dodge("a")).encounter?.dodging).toEqual(["a"]);
  });

  it("an attack on a dodger rolls disadvantage; a non-dodger rolls normal", () => {
    const s = dodged();
    // faces [18, 5] under disadvantage keep 5: 5+4=9 vs AC 13 misses.
    const out = run(s, attack("a", "b"), [18, 5]);
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      mode: "disadvantage",
    });
    expect(events[1]).toMatchObject({
      type: "attack.resolved",
      outcome: "miss",
    });
    const normal = run(s, attack("a", "c"), [18]);
    const ev = expectOk(normal.result);
    expect(ev[0]).toMatchObject({ mode: "normal" });
    expect(ev[1]).toMatchObject({ outcome: "hit" });
  });

  it("a reaction attack on a dodger rolls disadvantage", () => {
    const out = run(dodged(), attack("c", "b", { reaction: true }), [18, 5]);
    expect(expectOk(out.result)[0]).toMatchObject({ mode: "disadvantage" });
  });

  const save = (id: string, ability: string) => ({
    type: "check.roll",
    combatantId: id,
    kind: "saving-throw",
    ability,
    difficulty: "medium",
    reason: "save",
  });
  it("a dodger's Dex save rolls advantage; its Con save rolls normal", () => {
    const s = dodged();
    const dex = expectOk(run(s, save("b", "dex"), [3, 17]).result);
    expect(dex[0]).toMatchObject({ mode: "advantage" });
    expect(dex[1]).toMatchObject({ type: "check.resolved" });
    expect(expectOk(run(s, save("b", "con"), [17]).result)[0]).toMatchObject({
      mode: "normal",
    });
    expect(expectOk(run(s, save("c", "dex"), [17]).result)[0]).toMatchObject({
      mode: "normal",
    });
  });

  const cast = (spellId: string, targetId: string) => ({
    type: "spell.cast",
    casterId: "a",
    spellId,
    targetId,
    slotLevel: SPELLS[spellId]?.level ? SPELLS[spellId].level : null,
    casterLevel: 1,
    reason: "casts",
  });
  it("fire-bolt on a dodger rolls disadvantage; sacred-flame rolls the save with advantage", () => {
    const s = dodged();
    expect(
      expectOk(run(s, cast("fire-bolt", "b"), [18, 2]).result)[0],
    ).toMatchObject({
      mode: "disadvantage",
    });
    expect(
      expectOk(run(s, cast("fire-bolt", "c"), [18, 2]).result)[0],
    ).toMatchObject({
      mode: "normal",
    });
    expect(
      expectOk(run(s, cast("sacred-flame", "b"), [3, 17, 4]).result)[0],
    ).toMatchObject({ mode: "advantage" });
  });

  it("an incapacitated or Speed 0 dodger gives no source", () => {
    const incap = dodged();
    const withCond = (key: string) => {
      const c = incap.combatants.b as Combatant;
      return {
        ...incap,
        combatants: {
          ...incap.combatants,
          b: { ...c, conditions: [cond(key)] as never },
        },
      };
    };
    expect(isDodging(incap, "b")).toBe(true);
    for (const key of ["incapacitated", "grappled"]) {
      const s = withCond(key);
      expect(isDodging(s, "b")).toBe(false);
      expect(expectOk(run(s, attack("a", "b"), [18]).result)[0]).toMatchObject({
        mode: "normal",
      });
    }
  });

  it("holds through other turns and ends with the dodger's next turn.advance", () => {
    const s0 = play(play(started(), advance), dodge("b")); // b active
    const s1 = play(s0, advance); // c
    expect(s1.encounter?.dodging).toEqual(["b"]);
    const s2 = play(s1, advance); // a
    expect(s2.encounter?.dodging).toEqual(["b"]);
    const out = run(s2, advance); // b again
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "turn.advanced",
      "encounter.changed",
    ]);
    expect(settle(s2, out.result).encounter?.dodging).toEqual([]);
  });

  it("initiative.leave of the dodger clears it", () => {
    const s0 = play(play(started(), advance), dodge("b"));
    const left = play(s0, {
      type: "initiative.leave",
      combatantId: "b",
      reason: "gone",
    });
    expect(left.encounter?.dodging).toEqual([]);
  });

  it("refuses with no encounter, off turn, an unknown id and when unable", () => {
    expectRefusedBeforeDraw(
      run(stateWith(mk("a")), dodge("a")),
      "NO_ACTIVE_ENCOUNTER",
    );
    expectRefusedBeforeDraw(run(started(), dodge("b")), "MOVE_OFF_TURN");
    expectRefusedBeforeDraw(run(started(), dodge("zz")), "UNKNOWN_COMBATANT");
    expectRefusal(
      run(
        started({ a: { conditions: [cond("stunned")] as never } }),
        dodge("a"),
      ).result,
      "ACTOR_UNABLE",
    );
  });
});
