import { describe, expect, it } from "vitest";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const dying = (over = {}) =>
  makeCombatant({
    hp: { current: 0, max: 12, temp: 0 },
    lifeState: "unconscious",
    conditions: [
      {
        instanceId: "pc-ana#1",
        condition: "unconscious",
        level: null,
        source: "hp-zero",
        expiresAt: null,
      },
    ],
    conditionSeq: 1,
    ...over,
  });

const save = (mode = "normal") => ({
  type: "death-save.roll",
  targetId: "pc-ana",
  mode,
  reason: "death save",
});

describe("death-save.roll", () => {
  it("natural 1 adds two failures", () => {
    const state = stateWith(dying());
    const { result, rng } = run(state, save(), [1]);
    const events = expectOk(result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      purpose: "death-save",
      natural: 1,
    });
    expect(events[1]).toMatchObject({
      type: "death-saves.changed",
      rollIndex: 0,
      after: { successes: 0, failures: 2 },
    });
    expect(events).toHaveLength(2);
    expect(settle(state, result).combatants["pc-ana"]?.deathSaves).toEqual({
      successes: 0,
      failures: 2,
    });
    expect(rng.remaining()).toBe(0);
  });

  it("9 is a failure and 10 is a success", () => {
    const state = stateWith(dying());
    const f = run(state, save(), [9]);
    expect(settle(state, f.result).combatants["pc-ana"]?.deathSaves).toEqual({
      successes: 0,
      failures: 1,
    });
    const s = run(state, save(), [10]);
    expect(settle(state, s.result).combatants["pc-ana"]?.deathSaves).toEqual({
      successes: 1,
      failures: 0,
    });
  });

  it("natural 20 wakes the target at 1 HP", () => {
    const state = stateWith(
      dying({ deathSaves: { successes: 1, failures: 2 } }),
    );
    const { result } = run(state, save(), [20]);
    const events = expectOk(result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "hp.changed",
      "life-state.changed",
      "death-saves.changed",
      "condition.removed",
    ]);
    expect(events[1]).toMatchObject({
      cause: "death-save",
      before: { current: 0, temp: 0 },
      after: { current: 1, temp: 0 },
    });
    const c = settle(state, result).combatants["pc-ana"];
    expect(c).toMatchObject({
      lifeState: "conscious",
      hp: { current: 1 },
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
    });
  });

  it("natural 20 skips the tally event when it is already 0/0", () => {
    const state = stateWith(dying());
    const { result } = run(state, save(), [20]);
    expect(expectOk(result).map((e) => e.type)).not.toContain(
      "death-saves.changed",
    );
  });

  it("advantage keeps the higher face", () => {
    const state = stateWith(dying());
    const { result, rng } = run(state, save("advantage"), [4, 15]);
    expect(expectOk(result)[0]).toMatchObject({ natural: 15 });
    expect(settle(state, result).combatants["pc-ana"]?.deathSaves).toEqual({
      successes: 1,
      failures: 0,
    });
    expect(rng.remaining()).toBe(0);
  });

  it("a third success stabilizes and resets the tally", () => {
    const state = stateWith(
      dying({ deathSaves: { successes: 2, failures: 1 } }),
    );
    const { result } = run(state, save(), [12]);
    const events = expectOk(result);
    expect(events[1]).toMatchObject({ after: { successes: 0, failures: 0 } });
    expect(events[2]).toMatchObject({
      type: "life-state.changed",
      after: "stable",
    });
    expect(settle(state, result).combatants["pc-ana"]).toMatchObject({
      lifeState: "stable",
      deathSaves: { successes: 0, failures: 0 },
    });
  });

  it("a third failure kills and keeps the tally", () => {
    const state = stateWith(
      dying({ deathSaves: { successes: 1, failures: 2 } }),
    );
    const { result } = run(state, save(), [5]);
    const events = expectOk(result);
    expect(events[2]).toMatchObject({ after: "dead", before: "unconscious" });
    expect(settle(state, result).combatants["pc-ana"]).toMatchObject({
      lifeState: "dead",
      deathSaves: { successes: 1, failures: 3 },
    });
  });

  it("caps failures at three on a natural 1", () => {
    const state = stateWith(
      dying({ deathSaves: { successes: 0, failures: 2 } }),
    );
    const { result } = run(state, save(), [1]);
    expect(
      settle(state, result).combatants["pc-ana"]?.deathSaves.failures,
    ).toBe(3);
  });

  it("refuses NOT_DYING for conscious, stable, dead and dies-rule targets", () => {
    const cases = [
      makeCombatant(),
      dying({ lifeState: "stable" }),
      dying({ lifeState: "dead" }),
      makeCombatant({
        hp: { current: 0, max: 12, temp: 0 },
        lifeState: "unconscious",
        zeroHpRule: "dies",
      }),
    ];
    for (const c of cases) {
      expectRefusedBeforeDraw(run(stateWith(c), save()), "NOT_DYING");
    }
  });

  it("refuses an unknown target before any draw", () => {
    expectRefusedBeforeDraw(run(stateWith(), save()), "UNKNOWN_COMBATANT");
  });
});

describe("stabilize", () => {
  const stab = { type: "stabilize", targetId: "pc-ana", reason: "medicine" };

  it("resets the tally and stabilizes", () => {
    const state = stateWith(
      dying({ deathSaves: { successes: 1, failures: 2 } }),
    );
    const { result } = run(state, stab);
    expect(expectOk(result).map((e) => e.type)).toEqual([
      "death-saves.changed",
      "life-state.changed",
    ]);
    expect(settle(state, result).combatants["pc-ana"]).toMatchObject({
      lifeState: "stable",
      deathSaves: { successes: 0, failures: 0 },
    });
  });

  it("omits the tally event when it is already 0/0", () => {
    const state = stateWith(dying());
    const { result } = run(state, stab);
    expect(expectOk(result).map((e) => e.type)).toEqual(["life-state.changed"]);
  });

  it("refuses NOT_DYING and UNKNOWN_COMBATANT", () => {
    expectRefusedBeforeDraw(run(stateWith(makeCombatant()), stab), "NOT_DYING");
    expectRefusedBeforeDraw(run(stateWith(), stab), "UNKNOWN_COMBATANT");
  });
});
