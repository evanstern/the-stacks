import { describe, expect, it } from "vitest";
import { activeCombatant, replay } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const pc = (id: string, bonus = 0) =>
  makeCombatant({ id, name: id, initiativeBonus: bonus });

const roll = (ids: string[]) => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
  reason: "combat begins",
});
const advance = { type: "turn.advance", reason: "next turn" };
const leave = (combatantId: string) => ({
  type: "initiative.leave",
  combatantId,
  reason: "flees the scene",
});

/** Order after the roll: b (18), c (12, bonus 2), a (12). b is active. */
function started() {
  const state = stateWith(pc("a"), pc("b", 2), pc("c", 2));
  return settle(state, run(state, roll(["a", "b", "c"]), [12, 16, 10]).result);
}

const ids = (s: ReturnType<typeof started>) =>
  s.encounter?.order.map((e) => e.combatantId);

describe("initiative.leave", () => {
  it("removes a non-active combatant and keeps the active one", () => {
    const state = started();
    const out = run(state, leave("a"));
    const events = expectOk(out.result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "encounter.changed",
      combatantId: "a",
    });
    expect(out.counter.draws()).toBe(0);
    const next = settle(state, out.result);
    expect(ids(next)).toEqual(["b", "c"]);
    expect(next.encounter?.turnIndex).toBe(0);
    expect(activeCombatant(next)?.id).toBe("b");
    expect(next.combatants.a).toEqual(state.combatants.a);
  });

  it("keeps the active combatant when the leaver sits before it", () => {
    let state = started();
    state = settle(state, run(state, advance).result); // c active at index 1
    const next = settle(state, run(state, leave("b")).result);
    expect(ids(next)).toEqual(["c", "a"]);
    expect(next.encounter?.turnIndex).toBe(0);
    expect(activeCombatant(next)?.id).toBe("c");
  });

  it("hands the turn to the next entry when the active combatant leaves mid-order", () => {
    const state = started(); // b active at index 0
    const next = settle(state, run(state, leave("b")).result);
    expect(ids(next)).toEqual(["c", "a"]);
    expect(next.encounter?.turnIndex).toBe(0);
    expect(next.encounter?.round).toBe(1);
    expect(activeCombatant(next)?.id).toBe("c");
    expect(next.combatants.b).toBeDefined();
  });

  it("wraps to index 0 and a new round when the last entry leaves while active", () => {
    let state = started();
    state = settle(state, run(state, advance).result);
    state = settle(state, run(state, advance).result); // a active at index 2
    const out = run(state, {
      type: "condition.apply",
      targetId: "c",
      condition: "poisoned",
      source: "test",
      expiresAt: { round: 1, combatantId: "a", boundary: "turn-end" },
      reason: "x",
    });
    state = settle(state, out.result);
    const left = run(state, leave("a"));
    const events = expectOk(left.result);
    expect(events.map((e) => e.type)).toEqual([
      "condition.removed",
      "encounter.changed",
    ]);
    expect(events[0]).toMatchObject({
      cause: "expired",
      before: { condition: "poisoned" },
    });
    const next = settle(state, left.result);
    expect(ids(next)).toEqual(["b", "c"]);
    expect(next.encounter?.turnIndex).toBe(0);
    expect(next.encounter?.round).toBe(2);
    expect(activeCombatant(next)?.id).toBe("b");
  });

  it("expires the incoming combatant's turn-start conditions", () => {
    let state = started(); // b active; order b, c, a
    state = settle(
      state,
      run(state, {
        type: "condition.apply",
        targetId: "a",
        condition: "prone",
        source: "test",
        expiresAt: { round: 1, combatantId: "c", boundary: "turn-start" },
        reason: "x",
      }).result,
    );
    const out = run(state, leave("b"));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "encounter.changed",
      "condition.removed",
    ]);
    expect(events[1]).toMatchObject({
      cause: "expired",
      before: { condition: "prone" },
    });
    expect(activeCombatant(settle(state, out.result))?.id).toBe("c");
  });

  it("skips a dead combatant after the leaver and expires its boundaries", () => {
    let state = started(); // b active; order b, c, a
    state = {
      ...state,
      combatants: {
        ...state.combatants,
        c: {
          ...(state.combatants.c as NonNullable<typeof state.combatants.c>),
          lifeState: "dead",
          hp: { current: 0, max: 12, temp: 0 },
        },
      },
    };
    for (const boundary of ["turn-start", "turn-end"]) {
      state = settle(
        state,
        run(state, {
          type: "condition.apply",
          targetId: "a",
          condition: boundary === "turn-start" ? "prone" : "poisoned",
          source: "test",
          expiresAt: { round: 1, combatantId: "c", boundary },
          reason: "x",
        }).result,
      );
    }
    const out = run(state, leave("b"));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "condition.removed",
      "condition.removed",
      "encounter.changed",
    ]);
    const next = settle(state, out.result);
    expect(ids(next)).toEqual(["c", "a"]);
    expect(activeCombatant(next)?.id).toBe("a");
    expect(next.encounter?.turnIndex).toBe(1);
  });

  it("refuses when every remaining combatant is dead", () => {
    const base = started();
    const dead = (c: NonNullable<(typeof base.combatants)[string]>) => ({
      ...c,
      lifeState: "dead" as const,
      hp: { current: 0, max: 12, temp: 0 },
    });
    const s = {
      ...base,
      combatants: {
        ...base.combatants,
        c: dead(base.combatants.c as never),
        a: dead(base.combatants.a as never),
      },
    };
    expectRefusedBeforeDraw(run(s, leave("b")), "NO_ELIGIBLE_COMBATANT");
  });

  it("replays the events from the pre-state to the post-state", () => {
    const state = started();
    const out = run(state, leave("b"));
    const events = expectOk(out.result);
    expect(replay(events, state)).toEqual(settle(state, out.result));
  });

  it("refuses without an encounter", () => {
    expectRefusedBeforeDraw(
      run(stateWith(pc("a")), leave("a")),
      "NO_ACTIVE_ENCOUNTER",
    );
  });

  it("refuses an unknown combatant", () => {
    expectRefusedBeforeDraw(
      run(started(), leave("nobody")),
      "UNKNOWN_COMBATANT",
    );
  });

  it("refuses a combatant outside the order with reason not-in-order", () => {
    const base = started();
    const s = { ...base, combatants: { ...base.combatants, d: pc("d") } };
    const out = run(s, leave("d"));
    expectRefusedBeforeDraw(out, "UNKNOWN_COMBATANT");
    expect(out.result.ok).toBe(false);
    if (!out.result.ok) {
      expect(out.result.refusal.details).toMatchObject({
        combatantId: "d",
        reason: "not-in-order",
      });
    }
  });

  it("refuses when the last entry would leave", () => {
    const state = stateWith(pc("a"));
    const started1 = settle(state, run(state, roll(["a"]), [10]).result);
    expectRefusedBeforeDraw(run(started1, leave("a")), "NO_ELIGIBLE_COMBATANT");
  });
});
