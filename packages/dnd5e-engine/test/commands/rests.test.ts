import { describe, expect, it } from "vitest";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const fighter = (over = {}) =>
  makeCombatant({
    hp: { current: 5, max: 20, temp: 0 },
    conModifier: 2,
    hitDice: [{ die: 10, total: 5, remaining: 3 }],
    ...over,
  });

const short = (participants: unknown[]) => ({
  type: "rest.short",
  participants,
  reason: "an hour by the fire",
});
const long = (participants: string[]) => ({
  type: "rest.long",
  participants,
  reason: "a night's sleep",
});
const spend = (
  combatantId: string,
  ...s: { die: number; count: number }[]
) => ({
  combatantId,
  spend: s,
});

describe("rest.short", () => {
  it("spends hit dice and heals, capped at max", () => {
    const state = stateWith(fighter());
    const out = run(
      state,
      short([spend("pc-ana", { die: 10, count: 2 })]),
      [4, 7],
    );
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "dice.rolled",
      "hit-dice.changed",
      "hp.changed",
      "rest.completed",
    ]);
    expect(events[0]).toMatchObject({ purpose: "hit-die", expression: "1d10" });
    expect(events[2]).toMatchObject({
      before: { die: 10, remaining: 3 },
      after: { die: 10, remaining: 1 },
    });
    expect(events[3]).toMatchObject({
      cause: "rest",
      amount: 15,
      before: { current: 5 },
      after: { current: 20 },
    });
    expect(events[4]).toMatchObject({
      kind: "short",
      participants: ["pc-ana"],
    });
    const next = settle(state, out.result).combatants["pc-ana"];
    expect(next?.hp.current).toBe(20);
    expect(next?.hitDice[0]?.remaining).toBe(1);
  });

  it("heals 0 with a negative Con modifier and a face of 1", () => {
    const state = stateWith(fighter({ conModifier: -3 }));
    const out = run(
      state,
      short([spend("pc-ana", { die: 10, count: 1 })]),
      [1],
    );
    const events = expectOk(out.result);
    expect(events[2]).toMatchObject({
      type: "hp.changed",
      amount: 0,
      before: { current: 5 },
      after: { current: 5 },
    });
  });

  it("handles multiple pools", () => {
    const state = stateWith(
      fighter({
        hitDice: [
          { die: 8, total: 2, remaining: 2 },
          { die: 10, total: 2, remaining: 2 },
        ],
      }),
    );
    const out = run(
      state,
      short([spend("pc-ana", { die: 8, count: 1 }, { die: 10, count: 1 })]),
      [3, 5],
    );
    const events = expectOk(out.result);
    expect(events.filter((e) => e.type === "hit-dice.changed")).toHaveLength(2);
    expect(events.find((e) => e.type === "hp.changed")).toMatchObject({
      amount: 12,
    });
  });

  it("restores pact slots with an empty spend", () => {
    const state = stateWith(
      makeCombatant({
        spellSlots: {
          standard: {},
          pact: { level: 2, slot: { max: 2, expended: 2 } },
        },
      }),
    );
    const out = run(state, short([{ combatantId: "pc-ana" }]));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "spell-slots.changed",
      "rest.completed",
    ]);
    expect(
      settle(state, out.result).combatants["pc-ana"]?.spellSlots.pact?.slot
        .expended,
    ).toBe(0);
    expect(out.counter.draws()).toBe(0);
  });

  it("heals a stable creature out of 0", () => {
    const state = stateWith(
      fighter({
        hp: { current: 0, max: 20, temp: 0 },
        lifeState: "stable",
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
      }),
    );
    const out = run(
      state,
      short([spend("pc-ana", { die: 10, count: 1 })]),
      [6],
    );
    const types = expectOk(out.result).map((e) => e.type);
    expect(types).toContain("life-state.changed");
    expect(types).toContain("condition.removed");
    const next = settle(state, out.result).combatants["pc-ana"];
    expect(next).toMatchObject({ lifeState: "conscious", hp: { current: 8 } });
    expect(next?.conditions).toEqual([]);
  });

  it("refuses during an encounter", () => {
    const base = stateWith(fighter());
    const started = settle(
      base,
      run(
        base,
        {
          type: "initiative.roll",
          participants: [{ combatantId: "pc-ana", mode: "normal" }],
          reason: "x",
        },
        [10],
      ).result,
    );
    expectRefusedBeforeDraw(
      run(started, short([spend("pc-ana")])),
      "ENCOUNTER_ACTIVE",
    );
    expectRefusedBeforeDraw(run(started, long(["pc-ana"])), "ENCOUNTER_ACTIVE");
  });

  it("refuses too many dice and an absent size", () => {
    const state = stateWith(fighter());
    expectRefusedBeforeDraw(
      run(state, short([spend("pc-ana", { die: 10, count: 4 })]), [1, 1, 1, 1]),
      "INSUFFICIENT_HIT_DICE",
    );
    expectRefusedBeforeDraw(
      run(state, short([spend("pc-ana", { die: 8, count: 1 })]), [1]),
      "INSUFFICIENT_HIT_DICE",
    );
  });

  it("refuses unknown, duplicate and dead participants", () => {
    const dead = fighter({
      lifeState: "dead",
      hp: { current: 0, max: 20, temp: 0 },
    });
    expectRefusedBeforeDraw(
      run(stateWith(), short([spend("nobody")])),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(stateWith(fighter()), short([spend("pc-ana"), spend("pc-ana")])),
      "DUPLICATE_PARTICIPANT",
    );
    expectRefusedBeforeDraw(
      run(stateWith(dead), short([spend("pc-ana")])),
      "TARGET_DEAD",
    );
  });
});

describe("rest.long", () => {
  const worn = (over = {}) =>
    fighter({
      hp: { current: 4, max: 20, temp: 3 },
      hitDice: [{ die: 10, total: 5, remaining: 1 }],
      spellSlots: {
        standard: { "1": { max: 3, expended: 2 } },
        pact: { level: 2, slot: { max: 2, expended: 1 } },
      },
      ...over,
    });

  it("restores everything and clears temp HP", () => {
    const state = stateWith(worn());
    const out = run(state, long(["pc-ana"]));
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "hp.changed",
      "hit-dice.changed",
      "spell-slots.changed",
      "spell-slots.changed",
      "rest.completed",
    ]);
    expect(events[0]).toMatchObject({
      cause: "rest",
      amount: 16,
      before: { current: 4, temp: 3 },
      after: { current: 20, temp: 0 },
    });
    const c = settle(state, out.result).combatants["pc-ana"];
    expect(c?.hitDice[0]?.remaining).toBe(5);
    expect(c?.spellSlots.standard["1"]?.expended).toBe(0);
    expect(c?.spellSlots.pact?.slot.expended).toBe(0);
    expect(out.counter.draws()).toBe(0);
  });

  it("lowers exhaustion 2 to 1 and 1 to 0", () => {
    const exhausted = (level: number) =>
      worn({
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
    let state = stateWith(exhausted(2));
    const first = run(state, long(["pc-ana"]));
    expect(
      expectOk(first.result).find((e) => e.type === "condition.changed"),
    ).toMatchObject({
      after: { level: 1 },
    });
    state = settle(state, first.result);
    const second = run(state, long(["pc-ana"]));
    expect(
      expectOk(second.result).find((e) => e.type === "condition.removed"),
    ).toMatchObject({
      cause: "rest",
    });
    expect(
      settle(state, second.result).combatants["pc-ana"]?.conditions,
    ).toEqual([]);
  });

  it("emits only the rest marker when nothing changes", () => {
    const state = stateWith(makeCombatant());
    const events = expectOk(run(state, long(["pc-ana"])).result);
    expect(events.map((e) => e.type)).toEqual(["rest.completed"]);
  });

  it("refuses a participant at 0 HP", () => {
    const down = worn({
      hp: { current: 0, max: 20, temp: 0 },
      lifeState: "unconscious",
    });
    expectRefusedBeforeDraw(
      run(stateWith(down), long(["pc-ana"])),
      "LONG_REST_REQUIRES_HP",
    );
  });

  it("refuses dead, duplicate and unknown participants", () => {
    const dead = worn({
      lifeState: "dead",
      hp: { current: 0, max: 20, temp: 0 },
    });
    expectRefusedBeforeDraw(
      run(stateWith(dead), long(["pc-ana"])),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(stateWith(worn()), long(["pc-ana", "pc-ana"])),
      "DUPLICATE_PARTICIPANT",
    );
    expectRefusedBeforeDraw(
      run(stateWith(), long(["nobody"])),
      "UNKNOWN_COMBATANT",
    );
  });
});
