import { describe, expect, it } from "vitest";
import { conditionsOf } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const apply = (over: Record<string, unknown> = {}) => ({
  type: "condition.apply",
  targetId: "pc-ana",
  condition: "poisoned",
  source: "giant spider bite",
  reason: "poisoned by the spider",
  ...over,
});
const remove = (over: Record<string, unknown> = {}) => ({
  type: "condition.remove",
  targetId: "pc-ana",
  condition: "poisoned",
  reason: "cured",
  ...over,
});
const exhaust = (delta: number) => ({
  type: "exhaustion.adjust",
  targetId: "pc-ana",
  delta,
  reason: "forced march",
});

const withExhaustion = (level: number) =>
  makeCombatant({
    conditions: [
      {
        instanceId: "pc-ana#1",
        condition: "exhaustion",
        level,
        source: "exhaustion.adjust",
        expiresAt: null,
      },
    ],
    conditionSeq: 1,
  });

describe("condition.apply", () => {
  it("applies with source and expiry, and conditionsOf lists it", () => {
    const state = stateWith(makeCombatant());
    const expiresAt = { round: 3, combatantId: "pc-ana", boundary: "turn-end" };
    const out = run(state, apply({ expiresAt }));
    const [event] = expectOk(out.result);
    expect(event).toMatchObject({
      type: "condition.applied",
      conditionSeq: { before: 0, after: 1 },
      before: null,
      after: {
        instanceId: "pc-ana#1",
        condition: "poisoned",
        level: null,
        source: "giant spider bite",
        expiresAt,
      },
    });
    const next = settle(state, out.result);
    expect(conditionsOf(next, "pc-ana")).toHaveLength(1);
    expect(next.combatants["pc-ana"]?.conditionSeq).toBe(1);
    expect(out.counter.draws()).toBe(0);
  });

  it("numbers instances from the combatant's counter", () => {
    let state = stateWith(makeCombatant());
    state = settle(state, run(state, apply()).result);
    const out = run(state, apply({ condition: "prone" }));
    expect(expectOk(out.result)[0]).toMatchObject({
      after: { instanceId: "pc-ana#2" },
    });
  });

  it("refuses a second instance", () => {
    let state = stateWith(makeCombatant());
    state = settle(state, run(state, apply()).result);
    expectRefusedBeforeDraw(run(state, apply()), "CONDITION_ALREADY_PRESENT");
  });

  it("refuses exhaustion as INVALID_COMMAND", () => {
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), apply({ condition: "exhaustion" })),
      "INVALID_COMMAND",
    );
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), remove({ condition: "exhaustion" })),
      "INVALID_COMMAND",
    );
  });

  it("refuses a dead target and an unknown one", () => {
    const dead = makeCombatant({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusedBeforeDraw(run(stateWith(dead), apply()), "TARGET_DEAD");
    expectRefusedBeforeDraw(
      run(stateWith(), apply({ targetId: "nobody" })),
      "UNKNOWN_COMBATANT",
    );
  });
});

describe("condition.remove", () => {
  it("removes the condition", () => {
    let state = stateWith(makeCombatant());
    state = settle(state, run(state, apply()).result);
    const out = run(state, remove());
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "condition.removed",
      cause: "command",
      after: null,
    });
    expect(conditionsOf(settle(state, out.result), "pc-ana")).toEqual([]);
  });

  it("refuses an absent condition", () => {
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), remove()),
      "CONDITION_NOT_PRESENT",
    );
  });

  it("refuses an unknown combatant", () => {
    expectRefusedBeforeDraw(
      run(stateWith(), remove({ targetId: "nobody" })),
      "UNKNOWN_COMBATANT",
    );
  });

  it("succeeds on a dead target", () => {
    const dead = makeCombatant({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
      conditions: [
        {
          instanceId: "pc-ana#1",
          condition: "poisoned",
          level: null,
          source: "x",
          expiresAt: null,
        },
      ],
      conditionSeq: 1,
    });
    const state = stateWith(dead);
    const out = run(state, remove());
    expect(conditionsOf(settle(state, out.result), "pc-ana")).toEqual([]);
  });
});

describe("exhaustion.adjust", () => {
  it("applies from 0 to 1", () => {
    const state = stateWith(makeCombatant());
    const out = run(state, exhaust(1));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "condition.applied",
      after: { condition: "exhaustion", level: 1 },
    });
    expect(conditionsOf(settle(state, out.result), "pc-ana")[0]?.level).toBe(1);
  });

  it("changes 1 to 3", () => {
    const state = stateWith(withExhaustion(1));
    const out = run(state, exhaust(2));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "condition.changed",
      before: { level: 1 },
      after: { level: 3 },
    });
    expect(conditionsOf(settle(state, out.result), "pc-ana")[0]?.level).toBe(3);
  });

  it("removes at 3 to 0", () => {
    const state = stateWith(withExhaustion(3));
    const out = run(state, exhaust(-3));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "condition.removed",
      cause: "command",
    });
    expect(conditionsOf(settle(state, out.result), "pc-ana")).toEqual([]);
  });

  it("kills at level 6", () => {
    const state = stateWith(withExhaustion(5));
    const out = run(state, exhaust(1));
    const events = expectOk(out.result);
    expect(events[1]).toMatchObject({
      type: "life-state.changed",
      before: "conscious",
      after: "dead",
    });
    expect(settle(state, out.result).combatants["pc-ana"]?.lifeState).toBe(
      "dead",
    );
  });

  it("refuses out of range", () => {
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), exhaust(-1)),
      "EXHAUSTION_OUT_OF_RANGE",
    );
    expectRefusedBeforeDraw(
      run(stateWith(withExhaustion(5)), exhaust(2)),
      "EXHAUSTION_OUT_OF_RANGE",
    );
  });

  it("refuses an unknown or dead target", () => {
    expectRefusedBeforeDraw(run(stateWith(), exhaust(1)), "UNKNOWN_COMBATANT");
    const dead = makeCombatant({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusedBeforeDraw(run(stateWith(dead), exhaust(1)), "TARGET_DEAD");
  });
});
