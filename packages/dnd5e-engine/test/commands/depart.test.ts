import { describe, expect, it } from "vitest";
import { activeCombatant, type Combatant } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const pc = (id: string, bonus = 0, o = {}) =>
  makeCombatant({ id, name: id, initiativeBonus: bonus, ...o });
const roll = (ids: string[]) => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
  reason: "combat begins",
});
const depart = (combatantId: string) => ({
  type: "combatant.depart",
  combatantId,
  reason: "flees the scene",
});
const leave = (combatantId: string) => ({
  type: "initiative.leave",
  combatantId,
  reason: "flees the scene",
});
const zone = (id: string) => ({
  id,
  name: id,
  kind: "room",
  tags: [],
  hidden: false,
});

/** Order: b (18), c (12, bonus 2), a (12). b is active. */
function started(placed = false) {
  let state = stateWith(pc("a"), pc("b", 2), pc("c", 2));
  if (placed) {
    state = settle(
      state,
      run(state, {
        type: "space.define",
        space: { zones: [zone("z")], edges: [] },
        reason: "s",
      }).result,
    );
    for (const id of ["a", "b", "c"]) {
      state = settle(
        state,
        run(state, {
          type: "combatant.place",
          combatantId: id,
          zoneId: "z",
          reason: "p",
        }).result,
      );
    }
  }
  return settle(state, run(state, roll(["a", "b", "c"]), [12, 16, 10]).result);
}

describe("combatant.depart", () => {
  it("matches initiative.leave for an unplaced combatant, active or not", () => {
    for (const id of ["a", "b", "c"]) {
      const state = started();
      const d = run(state, depart(id), []);
      const l = run(state, leave(id), []);
      expect(expectOk(d.result)).toEqual(expectOk(l.result));
      expect(d.counter.draws()).toBe(0);
    }
  });

  it("removes a placed non-active combatant from the order and its zone", () => {
    const state = started(true);
    const out = run(state, depart("a"));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "encounter.changed",
      "combatant.placed",
    ]);
    expect(events[1]).toMatchObject({ before: { zoneId: "z" }, after: null });
    const next = settle(state, out.result);
    expect(next.encounter?.order.map((e) => e.combatantId)).toEqual(["b", "c"]);
    expect(next.combatants.a?.placement).toBeUndefined();
    expect(out.counter.draws()).toBe(0);
  });

  it("hands the turn on when the active combatant departs", () => {
    const state = started(true);
    const next = settle(state, run(state, depart("b")).result);
    expect(activeCombatant(next)?.id).toBe("c");
    expect(next.combatants.b?.placement).toBeUndefined();
  });

  it("drops a placed combatant that is not in the order (free mode)", () => {
    let state = stateWith(pc("a"));
    state = settle(
      state,
      run(state, {
        type: "space.define",
        space: { zones: [zone("z")], edges: [] },
        reason: "s",
      }).result,
    );
    state = settle(
      state,
      run(state, {
        type: "combatant.place",
        combatantId: "a",
        zoneId: "z",
        reason: "p",
      }).result,
    );
    const out = run(state, depart("a"));
    expect(expectOk(out.result).map((e) => e.type)).toEqual([
      "combatant.placed",
    ]);
    expect(settle(state, out.result).combatants.a?.placement).toBeUndefined();
  });

  it("ends the encounter when no living combatant would remain", () => {
    const state = stateWith(pc("a"));
    const one = settle(state, run(state, roll(["a"]), [10]).result);
    const events = expectOk(run(one, depart("a")).result);
    expect(events.map((e) => e.type)).toEqual(["encounter.ended"]);
    expect(settle(one, run(one, depart("a")).result).encounter).toBeNull();
    // every remaining entry dead
    const base = started();
    const dead = (c: Combatant) => ({
      ...c,
      lifeState: "dead" as const,
      hp: { current: 0, max: 12, temp: 0 },
    });
    const s = {
      ...base,
      combatants: {
        ...base.combatants,
        c: dead(base.combatants.c as Combatant),
        a: dead(base.combatants.a as Combatant),
      },
    };
    const out = run(s, depart("b"));
    expect(expectOk(out.result).map((e) => e.type)).toEqual([
      "encounter.ended",
    ]);
    expect(settle(s, out.result).encounter).toBeNull();
  });

  it("refuses a combatant that is neither in the order nor placed", () => {
    expectRefusedBeforeDraw(
      run(stateWith(pc("a")), depart("a")),
      "INVALID_COMMAND",
    );
    const base = started();
    const s = { ...base, combatants: { ...base.combatants, d: pc("d") } };
    expectRefusedBeforeDraw(run(s, depart("d")), "INVALID_COMMAND");
  });

  it("refuses an unknown combatant", () => {
    expectRefusedBeforeDraw(run(started(), depart("zz")), "UNKNOWN_COMBATANT");
  });
});
