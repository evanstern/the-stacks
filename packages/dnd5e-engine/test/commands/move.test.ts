import { describe, expect, it } from "vitest";
import {
  activeCombatant,
  type EngineState,
  effectiveSpeed,
  movementLeft,
  spaceViewOf,
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

const zone = (id: string) => ({
  id,
  name: id,
  kind: "room",
  tags: [],
  hidden: false,
});
const edge = (from: string, to: string, feet: number, kind = "open") => ({
  from,
  to,
  feet,
  kind,
});
const space = (edges = [edge("a", "b", 20), edge("b", "c", 20)]) => ({
  zones: ["a", "b", "c", "d"].map(zone),
  edges,
});
const defineSpace = (s = space()) => ({
  type: "space.define",
  space: s,
  reason: "scene",
});
const place = (combatantId: string, zoneId: string | null) => ({
  type: "combatant.place",
  combatantId,
  zoneId,
  reason: "placed",
});
const move = (combatantId: string, toZoneId: string) => ({
  type: "move",
  combatantId,
  toZoneId,
  reason: "walks",
});
const action = (combatantId: string, a: "dash" | "disengage") => ({
  type: "movement.action",
  combatantId,
  action: a,
  reason: "action",
});

const hero = (o = {}) =>
  makeCombatant({
    id: "hero",
    name: "Hero",
    speed: 30,
    placement: { zoneId: "a" },
    ...o,
  });
const foe = (o = {}) =>
  makeCombatant({
    id: "foe",
    name: "Foe",
    speed: 30,
    placement: { zoneId: "a" },
    ...o,
  });

function withSpace(s = space(), ...cs: ReturnType<typeof hero>[]): EngineState {
  const base = stateWith(...cs.map((c) => ({ ...c, placement: undefined })));
  let state = settle(base, run(base, defineSpace(s)).result);
  for (const c of cs) {
    if (c.placement)
      state = settle(state, run(state, place(c.id, c.placement.zoneId)).result);
  }
  return state;
}

/** Hero acts first (18 vs 10). */
function inEncounter(
  s = space(),
  ...cs: ReturnType<typeof hero>[]
): EngineState {
  const state = withSpace(s, ...(cs.length ? cs : [hero(), foe()]));
  const out = run(
    state,
    {
      type: "initiative.roll",
      participants: Object.keys(state.combatants).map((combatantId) => ({
        combatantId,
        mode: "normal",
      })),
      reason: "combat",
    },
    Object.keys(state.combatants).map((id) => (id === "hero" ? 18 : 10)),
  );
  return settle(state, out.result);
}

describe("space.define", () => {
  it("sets the space and replaces it", () => {
    const state = stateWith(hero({ placement: undefined }));
    const out = run(state, defineSpace());
    const [e] = expectOk(out.result);
    expect(e).toMatchObject({ type: "space.defined", before: null });
    expect(out.counter.draws()).toBe(0);
    const next = settle(state, out.result);
    expect(next.space?.zones).toHaveLength(4);
    const again = expectOk(
      run(next, defineSpace({ zones: [zone("a")], edges: [] })).result,
    );
    expect(again[0]).toMatchObject({ before: next.space });
  });
  it("refuses ZONE_IN_USE when a placed combatant's zone is dropped", () => {
    const state = withSpace(space(), hero());
    expectRefusedBeforeDraw(
      run(state, defineSpace({ zones: [zone("b")], edges: [] })),
      "ZONE_IN_USE",
    );
  });
});

describe("combatant.place", () => {
  it("places, moves and clears a placement without edge or speed checks", () => {
    let state = withSpace(space(), hero({ placement: undefined }));
    const out = run(state, place("hero", "d"));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "combatant.placed",
      before: null,
      after: { zoneId: "d" },
    });
    expect(out.counter.draws()).toBe(0);
    state = settle(state, out.result);
    expect(state.combatants.hero?.placement).toEqual({ zoneId: "d" });
    state = settle(state, run(state, place("hero", null)).result);
    expect(state.combatants.hero?.placement).toBeUndefined();
  });
  it("refuses with no space, an unknown zone or an unknown combatant", () => {
    expectRefusal(
      run(stateWith(hero({ placement: undefined })), place("hero", "a")).result,
      "SPACE_UNDEFINED",
    );
    const state = withSpace(space(), hero());
    expectRefusal(run(state, place("hero", "zz")).result, "ZONE_UNKNOWN");
    expectRefusal(run(state, place("ghost", "a")).result, "UNKNOWN_COMBATANT");
  });
});

describe("move", () => {
  it("US1.1: moves along the path and records movement used", () => {
    const state = inEncounter();
    const out = run(state, move("hero", "b"));
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      type: "combatant.moved",
      path: ["a", "b"],
      feet: 20,
      before: { zoneId: "a" },
      after: { zoneId: "b" },
    });
    expect(out.counter.draws()).toBe(0);
    const next = settle(state, out.result);
    expect(next.encounter?.movement).toMatchObject({
      combatantId: "hero",
      usedFt: 20,
    });
    expect(movementLeft(next, "hero")).toBe(10);
    expect(activeCombatant(next)?.id).toBe("hero");
  });
  it("US1.2: refuses MOVE_OVER_SPEED on the second leg", () => {
    const state = inEncounter();
    const next = settle(state, run(state, move("hero", "b")).result);
    expectRefusedBeforeDraw(run(next, move("hero", "c")), "MOVE_OVER_SPEED");
  });
  it("US1.3: refuses MOVE_BLOCKED across a blocked edge", () => {
    const state = withSpace(space([edge("a", "b", 20, "blocked")]), hero());
    expectRefusedBeforeDraw(run(state, move("hero", "b")), "MOVE_BLOCKED");
  });
  it("US1.4: dash doubles the budget", () => {
    const state = inEncounter();
    const dashed = settle(state, run(state, action("hero", "dash")).result);
    expect(movementLeft(dashed, "hero")).toBe(60);
    const out = run(dashed, move("hero", "c"));
    expectOk(out.result);
  });
  it("US1.5: no encounter means no speed budget, but blocked still refuses", () => {
    const far = space([edge("a", "b", 500), edge("b", "c", 500)]);
    const state = withSpace(far, hero({ speed: undefined }));
    const next = settle(state, run(state, move("hero", "c")).result);
    expect(next.combatants.hero?.placement).toEqual({ zoneId: "c" });
    expect(movementLeft(next, "hero")).toBeNull();
    expectRefusal(
      run(
        withSpace(space([edge("a", "b", 5, "blocked")]), hero()),
        move("hero", "b"),
      ).result,
      "MOVE_BLOCKED",
    );
  });
  it("US1.6: refuses MOVE_OFF_TURN for a non-active combatant", () => {
    const state = inEncounter();
    expectRefusedBeforeDraw(run(state, move("foe", "b")), "MOVE_OFF_TURN");
  });
  it("refuses a move to the own zone as INVALID_COMMAND", () => {
    expectRefusal(
      run(withSpace(space(), hero()), move("hero", "a")).result,
      "INVALID_COMMAND",
    );
  });
  it("prone doubles the cost", () => {
    const state = inEncounter(
      space(),
      hero({
        conditions: [
          {
            instanceId: "c1",
            condition: "prone",
            level: null,
            source: "x",
            expiresAt: null,
          },
        ],
        conditionSeq: 1,
      }),
      foe(),
    );
    // a-b is 20 ft, prone 40 > 30
    expectRefusal(run(state, move("hero", "b")).result, "MOVE_OVER_SPEED");
  });
  it("speed-0 conditions and exhaustion lower the speed", () => {
    const cond = (condition: "restrained" | "exhaustion", level?: number) => ({
      instanceId: "c1",
      condition,
      source: "x",
      expiresAt: null,
      level: level ?? null,
    });
    expect(effectiveSpeed(hero({ conditions: [cond("restrained")] }))).toBe(0);
    expect(effectiveSpeed(hero({ conditions: [cond("exhaustion", 2)] }))).toBe(
      20,
    );
    expect(effectiveSpeed(hero({ conditions: [cond("exhaustion", 9)] }))).toBe(
      0,
    );
    expect(effectiveSpeed(hero({ speed: undefined }))).toBeNull();
    const state = inEncounter(
      space(),
      hero({ conditions: [cond("restrained")], conditionSeq: 1 }),
      foe(),
    );
    expectRefusal(run(state, move("hero", "b")).result, "MOVE_OVER_SPEED");
  });
  it("refuses ACTOR_UNABLE for dead or incapacitated movers", () => {
    const state = withSpace(
      space(),
      hero({ lifeState: "unconscious", hp: { current: 0, max: 12, temp: 0 } }),
    );
    expectRefusal(run(state, move("hero", "b")).result, "ACTOR_UNABLE");
    const dead = withSpace(
      space(),
      hero({ lifeState: "dead", hp: { current: 0, max: 12, temp: 0 } }),
    );
    expectRefusal(run(dead, move("hero", "b")).result, "ACTOR_UNABLE");
  });
  it("refuses STAT_UNDEFINED in an encounter with no speed", () => {
    const state = inEncounter(space(), hero({ speed: undefined }), foe());
    expectRefusal(run(state, move("hero", "b")).result, "STAT_UNDEFINED");
  });
  it("refuses SPACE_UNDEFINED, NOT_PLACED, ZONE_UNKNOWN, UNKNOWN_COMBATANT", () => {
    expectRefusal(
      run(stateWith(hero({ placement: undefined })), move("hero", "b")).result,
      "SPACE_UNDEFINED",
    );
    const state = withSpace(space(), hero({ placement: undefined }));
    expectRefusal(run(state, move("hero", "b")).result, "NOT_PLACED");
    expectRefusal(
      run(withSpace(space(), hero()), move("hero", "zz")).result,
      "ZONE_UNKNOWN",
    );
    expectRefusal(run(state, move("ghost", "b")).result, "UNKNOWN_COMBATANT");
  });
  it("picks the cheapest route, and a squeeze costs double", () => {
    const s = space([
      edge("a", "c", 10, "squeeze"),
      edge("a", "b", 5),
      edge("b", "c", 5),
    ]);
    const state = withSpace(s, hero());
    const events = expectOk(run(state, move("hero", "c")).result);
    expect(events[0]).toMatchObject({ path: ["a", "b", "c"], feet: 10 });
  });
});

describe("movement.action", () => {
  it("records dash and disengage as encounter.changed", () => {
    const state = inEncounter();
    const dashed = settle(state, run(state, action("hero", "dash")).result);
    const both = settle(
      dashed,
      run(dashed, action("hero", "disengage")).result,
    );
    expect(both.encounter?.movement).toMatchObject({
      dashes: 1,
      disengaged: true,
    });
    const out = run(state, action("hero", "disengage"));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "encounter.changed",
      combatantId: "hero",
    });
    expect(out.counter.draws()).toBe(0);
  });
  it("refuses off turn, outside an encounter, and for unknown combatants", () => {
    const state = inEncounter();
    expectRefusal(run(state, action("foe", "dash")).result, "MOVE_OFF_TURN");
    expectRefusal(
      run(withSpace(space(), hero()), action("hero", "dash")).result,
      "NO_ACTIVE_ENCOUNTER",
    );
    expectRefusal(
      run(state, action("ghost", "dash")).result,
      "UNKNOWN_COMBATANT",
    );
  });
  it("a stale record from a past turn reads as zero movement used", () => {
    const state = inEncounter();
    const moved = settle(state, run(state, move("hero", "b")).result);
    // foe's turn, then hero again in round 2
    const t1 = settle(
      moved,
      run(moved, { type: "turn.advance", reason: "n" }).result,
    );
    const t2 = settle(
      t1,
      run(t1, { type: "turn.advance", reason: "n" }).result,
    );
    expect(t2.encounter?.round).toBe(2);
    expect(movementLeft(t2, "hero")).toBe(30);
  });
});

describe("spaceViewOf", () => {
  it("exposes combatant placements and the space", () => {
    const state = withSpace(
      space(),
      hero(),
      foe({ placement: { zoneId: "b" } }),
    );
    const view = spaceViewOf(state);
    expect(view.placements).toEqual({ hero: "a", foe: "b" });
    expect(view.space).toEqual(state.space);
    expect(
      spaceViewOf(stateWith(hero({ placement: undefined }))).space,
    ).toBeNull();
  });
});
