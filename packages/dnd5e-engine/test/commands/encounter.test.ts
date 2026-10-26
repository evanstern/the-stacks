import { describe, expect, it } from "vitest";
import { activeCombatant, conditionsOf } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const pc = (id: string, bonus = 0, over = {}) =>
  makeCombatant({ id, name: id, initiativeBonus: bonus, ...over });

const dead = {
  lifeState: "dead",
  hp: { current: 0, max: 12, temp: 0 },
} as const;

const roll = (ids: string[], mode = "normal") => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode })),
  reason: "combat begins",
});
const advance = { type: "turn.advance", reason: "next turn" };
const end = { type: "encounter.end", reason: "combat over" };
const join = (combatantId: string, mode = "normal") => ({
  type: "initiative.join",
  combatantId,
  mode,
  reason: "reinforcements",
});

function started(
  state = stateWith(pc("a"), pc("b", 2), pc("c", 2)),
  faces = [12, 16, 10],
) {
  const out = run(state, roll(["a", "b", "c"]), faces);
  return settle(state, out.result);
}

const turnEnd = (round: number, combatantId: string) => ({
  round,
  combatantId,
  boundary: "turn-end" as const,
});

describe("initiative.roll", () => {
  it("orders by total, then bonus, then id", () => {
    const state = stateWith(pc("a"), pc("b", 2), pc("c", 2));
    const out = run(state, roll(["a", "b", "c"]), [12, 16, 10]);
    const events = expectOk(out.result);
    expect(events).toHaveLength(4);
    expect(events.slice(0, 3)).toMatchObject([
      {
        type: "dice.rolled",
        purpose: "initiative",
        combatantId: "a",
        total: 12,
      },
      {
        type: "dice.rolled",
        purpose: "initiative",
        combatantId: "b",
        total: 18,
      },
      {
        type: "dice.rolled",
        purpose: "initiative",
        combatantId: "c",
        total: 12,
      },
    ]);
    const next = settle(state, out.result);
    expect(next.encounter?.order.map((e) => e.combatantId)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(next.encounter).toMatchObject({ round: 1, turnIndex: 0 });
    expect(activeCombatant(next)?.id).toBe("b");
  });

  it("breaks a full tie by id", () => {
    const state = stateWith(pc("zed"), pc("amy"));
    const next = settle(state, run(state, roll(["zed", "amy"]), [9, 9]).result);
    expect(next.encounter?.order.map((e) => e.combatantId)).toEqual([
      "amy",
      "zed",
    ]);
  });

  it("rolls advantage on one participant", () => {
    const state = stateWith(pc("a"), pc("b"));
    const out = run(
      state,
      {
        type: "initiative.roll",
        participants: [
          { combatantId: "a", mode: "advantage" },
          { combatantId: "b", mode: "normal" },
        ],
        reason: "x",
      },
      [3, 17, 10],
    );
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      mode: "advantage",
      total: 17,
      natural: 17,
    });
    expect(events[1]).toMatchObject({ mode: "normal", total: 10 });
    expect(settle(state, out.result).encounter?.order[0]?.combatantId).toBe(
      "a",
    );
  });

  it("applies a negative bonus", () => {
    const state = stateWith(pc("a", -2));
    const out = run(state, roll(["a"]), [10]);
    expect(expectOk(out.result)[0]).toMatchObject({
      expression: "1d20-2",
      total: 8,
    });
  });

  it("refuses while an encounter is active", () => {
    expectRefusedBeforeDraw(run(started(), roll(["a"])), "ENCOUNTER_ACTIVE");
  });

  it("refuses unknown, duplicate and dead participants", () => {
    const state = stateWith(pc("a"), pc("d", 0, dead));
    expectRefusedBeforeDraw(
      run(state, roll(["a", "nobody"])),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(state, roll(["a", "a"])),
      "DUPLICATE_PARTICIPANT",
    );
    expectRefusedBeforeDraw(run(state, roll(["a", "d"])), "TARGET_DEAD");
  });
});

describe("turn.advance", () => {
  it("advances through a round wrap", () => {
    let state = started();
    state = settle(state, run(state, advance).result);
    expect(activeCombatant(state)?.id).toBe("c");
    state = settle(state, run(state, advance).result);
    expect(activeCombatant(state)?.id).toBe("a");
    const out = run(state, advance);
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "turn.advanced",
      skipped: [],
      before: { round: 1, turnIndex: 2, combatantId: "a" },
      after: { round: 2, turnIndex: 0, combatantId: "b" },
    });
    expect(settle(state, out.result).encounter).toMatchObject({
      round: 2,
      turnIndex: 0,
    });
  });

  it("skips a dead combatant and lists it", () => {
    let state = started();
    state = {
      ...state,
      combatants: { ...state.combatants, c: { ...pc("c", 2), ...dead } },
    };
    const out = run(state, advance);
    expect(expectOk(out.result)[0]).toMatchObject({
      skipped: ["c"],
      after: { turnIndex: 2, combatantId: "a" },
    });
  });

  it("expires turn-end and turn-start conditions at the right boundary", () => {
    let state = started();
    const expire = (
      condition: string,
      boundary: string,
      combatantId: string,
      round = 1,
    ) =>
      run(state, {
        type: "condition.apply",
        targetId: "a",
        condition,
        source: "test",
        expiresAt: { round, combatantId, boundary },
        reason: "x",
      }).result;
    state = settle(state, expire("poisoned", "turn-end", "b"));
    state = settle(state, expire("prone", "turn-start", "c"));
    // b ends its turn: poisoned falls off, then c starts: prone falls off.
    const out = run(state, advance);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "condition.removed",
      "turn.advanced",
      "condition.removed",
    ]);
    expect(events[0]).toMatchObject({
      cause: "expired",
      before: { condition: "poisoned" },
    });
    expect(events[2]).toMatchObject({
      cause: "expired",
      before: { condition: "prone" },
    });
    expect(conditionsOf(settle(state, out.result), "a")).toEqual([]);
  });

  it("does not expire a condition for another round", () => {
    let state = started();
    state = settle(
      state,
      run(state, {
        type: "condition.apply",
        targetId: "a",
        condition: "poisoned",
        source: "test",
        expiresAt: turnEnd(2, "b"),
        reason: "x",
      }).result,
    );
    const out = run(state, advance);
    expect(expectOk(out.result).map((e) => e.type)).toEqual(["turn.advanced"]);
  });

  it("crosses expiry points of a skipped turn", () => {
    let state = started();
    state = {
      ...state,
      combatants: { ...state.combatants, c: { ...pc("c", 2), ...dead } },
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
    const out = run(state, advance);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "condition.removed",
      "condition.removed",
      "turn.advanced",
    ]);
    expect(conditionsOf(settle(state, out.result), "a")).toEqual([]);
  });

  it("refuses with no encounter and with only the dead", () => {
    expectRefusedBeforeDraw(
      run(stateWith(pc("a")), advance),
      "NO_ACTIVE_ENCOUNTER",
    );
    const state = started();
    const allDead = {
      ...state,
      combatants: Object.fromEntries(
        Object.entries(state.combatants).map(([k, v]) => [
          k,
          { ...v, ...dead },
        ]),
      ),
    };
    expectRefusedBeforeDraw(run(allDead, advance), "NO_ELIGIBLE_COMBATANT");
  });
});

describe("initiative.join", () => {
  it("inserts before the active index and keeps the active combatant", () => {
    let state = started();
    state = settle(state, run(state, advance).result); // c is active at index 1
    const next = (() => {
      const s = { ...state, combatants: { ...state.combatants, d: pc("d") } };
      return settle(s, run(s, join("d"), [19]).result);
    })();
    expect(next.encounter?.order.map((e) => e.combatantId)).toEqual([
      "d",
      "b",
      "c",
      "a",
    ]);
    expect(next.encounter?.turnIndex).toBe(2);
    expect(activeCombatant(next)?.id).toBe("c");
  });

  it("inserts after the active index without moving it", () => {
    const base = started();
    const s = { ...base, combatants: { ...base.combatants, d: pc("d") } };
    const out = run(s, join("d"), [1]);
    const events = expectOk(out.result);
    expect(events[1]).toMatchObject({
      type: "encounter.changed",
      combatantId: "d",
    });
    const next = settle(s, out.result);
    expect(next.encounter?.order.map((e) => e.combatantId)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(next.encounter?.turnIndex).toBe(0);
  });

  it("refuses without an encounter, unknown, already joined and dead", () => {
    expectRefusedBeforeDraw(
      run(stateWith(pc("a")), join("a")),
      "NO_ACTIVE_ENCOUNTER",
    );
    const base = started();
    expectRefusedBeforeDraw(run(base, join("nobody")), "UNKNOWN_COMBATANT");
    expectRefusedBeforeDraw(run(base, join("a")), "ALREADY_IN_ENCOUNTER");
    const s = {
      ...base,
      combatants: { ...base.combatants, d: pc("d", 0, dead) },
    };
    expectRefusedBeforeDraw(run(s, join("d")), "TARGET_DEAD");
  });
});

describe("encounter.end", () => {
  it("removes round-expiry conditions and clears the encounter", () => {
    let state = started();
    state = settle(
      state,
      run(state, {
        type: "condition.apply",
        targetId: "a",
        condition: "poisoned",
        source: "test",
        expiresAt: turnEnd(5, "b"),
        reason: "x",
      }).result,
    );
    state = settle(
      state,
      run(state, {
        type: "condition.apply",
        targetId: "a",
        condition: "prone",
        source: "test",
        reason: "x",
      }).result,
    );
    const out = run(state, end);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "condition.removed",
      "encounter.ended",
    ]);
    expect(events[0]).toMatchObject({ cause: "encounter-ended" });
    const next = settle(state, out.result);
    expect(next.encounter).toBeNull();
    expect(conditionsOf(next, "a").map((i) => i.condition)).toEqual(["prone"]);
  });

  it("refuses with no encounter", () => {
    expectRefusedBeforeDraw(
      run(stateWith(pc("a")), end),
      "NO_ACTIVE_ENCOUNTER",
    );
  });
});
