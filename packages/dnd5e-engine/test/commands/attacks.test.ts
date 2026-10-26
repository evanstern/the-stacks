import { describe, expect, it } from "vitest";
import { SkillSchema } from "../../src/index.js";
import {
  expectOk,
  expectRefusal,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const goblin = (over = {}) =>
  makeCombatant({
    id: "gob-1",
    name: "Goblin",
    ac: 15,
    hp: { current: 7, max: 7, temp: 0 },
    ...over,
  });
const hero = (over = {}) => makeCombatant({ id: "pc-ana", ...over });

const attack = (over: Record<string, unknown> = {}) => ({
  type: "attack.roll",
  attackerId: "pc-ana",
  targetId: "gob-1",
  expression: "1d20+5",
  reason: "scimitar swing",
  ...over,
});
const check = (over: Record<string, unknown> = {}) => ({
  type: "check.roll",
  combatantId: "gob-1",
  kind: "saving-throw",
  ability: "dex",
  expression: "1d20+2",
  dc: 13,
  reason: "fireball",
  ...over,
});
const outcomeOf = (events: ReturnType<typeof expectOk>) => {
  const e = events.find((x) => x.type === "attack.resolved");
  if (e?.type !== "attack.resolved") throw new Error("no attack.resolved");
  return e;
};
const checkOf = (events: ReturnType<typeof expectOk>) => {
  const e = events.find((x) => x.type === "check.resolved");
  if (e?.type !== "check.resolved") throw new Error("no check.resolved");
  return e;
};
const state = () => stateWith(hero(), goblin());

describe("attack.roll", () => {
  it("natural 20 is a critical hit against any AC", () => {
    const { result, rng } = run(
      stateWith(hero(), goblin({ ac: 30 })),
      attack(),
      [20],
    );
    const events = expectOk(result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
    expect(events[0]).toMatchObject({
      purpose: "attack",
      combatantId: "pc-ana",
    });
    expect(outcomeOf(events)).toMatchObject({
      outcome: "critical-hit",
      natural: 20,
      total: 25,
      ac: 30,
      acSource: "record",
      rollIndex: 0,
      attackerId: "pc-ana",
      targetId: "gob-1",
    });
    expect(rng.remaining()).toBe(0);
  });

  it("natural 1 is a miss whatever the total", () => {
    const { result } = run(
      stateWith(hero(), goblin({ ac: 5 })),
      attack({ expression: "1d20+10" }),
      [1],
    );
    expect(outcomeOf(expectOk(result))).toMatchObject({
      outcome: "miss",
      total: 11,
      natural: 1,
    });
  });

  it("a total equal to AC hits and one below misses", () => {
    expect(
      outcomeOf(expectOk(run(state(), attack(), [10]).result)),
    ).toMatchObject({
      outcome: "hit",
      total: 15,
    });
    expect(
      outcomeOf(expectOk(run(state(), attack(), [9]).result)),
    ).toMatchObject({
      outcome: "miss",
      total: 14,
    });
  });

  it("scripted faces 20, 1 and 15 against AC 15 give crit, miss, hit", () => {
    const outcomes = [20, 1, 15].map(
      (face) =>
        outcomeOf(
          expectOk(run(state(), attack({ expression: "1d20" }), [face]).result),
        ).outcome,
    );
    expect(outcomes).toEqual(["critical-hit", "miss", "hit"]);
  });

  it("advantage keeps the higher d20 and natural is the kept face", () => {
    const { result, rng } = run(
      state(),
      attack({ mode: "advantage" }),
      [3, 12],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({ mode: "advantage", natural: 12 });
    expect(outcomeOf(events)).toMatchObject({
      natural: 12,
      total: 17,
      outcome: "hit",
    });
    expect(rng.remaining()).toBe(0);
  });

  it("disadvantage keeps the lower d20", () => {
    const { result } = run(state(), attack({ mode: "disadvantage" }), [3, 12]);
    expect(outcomeOf(expectOk(result))).toMatchObject({
      natural: 3,
      outcome: "miss",
    });
  });

  it("a bonus die counts toward the total", () => {
    const { result, rng } = run(
      state(),
      attack({ expression: "1d20+5+1d4" }),
      [8, 3],
    );
    expect(outcomeOf(expectOk(result))).toMatchObject({
      total: 16,
      natural: 8,
      outcome: "hit",
    });
    expect(rng.remaining()).toBe(0);
  });

  it("targetAc overrides the record and the event says so", () => {
    const { result } = run(state(), attack({ targetAc: 20 }), [10]);
    expect(outcomeOf(expectOk(result))).toMatchObject({
      ac: 20,
      acSource: "command",
      outcome: "miss",
    });
  });

  it("targetAc supplies the AC when the record has none", () => {
    const { result } = run(
      stateWith(hero(), goblin({ ac: null })),
      attack({ targetAc: 12 }),
      [10],
    );
    expect(outcomeOf(expectOk(result))).toMatchObject({
      ac: 12,
      acSource: "command",
    });
  });

  it("allows a null attacker", () => {
    const { result } = run(
      stateWith(goblin()),
      attack({ attackerId: null }),
      [10],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({ combatantId: null });
    expect(outcomeOf(events)).toMatchObject({ attackerId: null });
  });

  it("changes no state", () => {
    const s = state();
    const { result } = run(s, attack(), [10]);
    expect(settle(s, result)).toEqual(s);
  });

  it("refuses D20_TERM_REQUIRED without a plain d20", () => {
    for (const expression of ["2d20", "1d20kh1", "1d6+3", "1d20+1d20", "5"]) {
      expectRefusedBeforeDraw(
        run(state(), attack({ expression })),
        "D20_TERM_REQUIRED",
      );
    }
  });

  it("refuses TARGET_AC_UNKNOWN", () => {
    expectRefusedBeforeDraw(
      run(stateWith(hero(), goblin({ ac: null })), attack()),
      "TARGET_AC_UNKNOWN",
    );
  });

  it("refuses unknown target and attacker", () => {
    expectRefusedBeforeDraw(
      run(stateWith(hero()), attack()),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(stateWith(goblin()), attack()),
      "UNKNOWN_COMBATANT",
    );
  });

  it("refuses a dead target and a dead attacker", () => {
    const dead = {
      lifeState: "dead",
      hp: { current: 0, max: 7, temp: 0 },
    } as const;
    expectRefusedBeforeDraw(
      run(stateWith(hero(), goblin(dead)), attack()),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(
          hero({ ...dead, hp: { current: 0, max: 12, temp: 0 } }),
          goblin(),
        ),
        attack(),
      ),
      "TARGET_DEAD",
    );
  });

  it("refuses bad expressions and limits", () => {
    expectRefusedBeforeDraw(
      run(state(), attack({ expression: "1d20++2" })),
      "INVALID_DICE_EXPRESSION",
    );
    expectRefusedBeforeDraw(
      run(state(), attack({ expression: "1d20+101d6" })),
      "DICE_LIMIT_EXCEEDED",
    );
  });
});

describe("check.roll", () => {
  it("a save succeeds at exactly the DC (DC 13, 1d20+2, face 11)", () => {
    const { result, rng } = run(state(), check(), [11]);
    const events = expectOk(result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "check.resolved",
    ]);
    expect(events[0]).toMatchObject({ purpose: "save", combatantId: "gob-1" });
    expect(checkOf(events)).toMatchObject({
      outcome: "success",
      total: 13,
      natural: 11,
      dc: 13,
      kind: "saving-throw",
      ability: "dex",
      skill: null,
      rollIndex: 0,
      autoFail: null,
    });
    expect(rng.remaining()).toBe(0);
  });

  it("a save fails one below the DC", () => {
    const { result } = run(state(), check(), [10]);
    expect(checkOf(expectOk(result))).toMatchObject({
      outcome: "failure",
      total: 12,
    });
  });

  it("natural 20 below the DC still fails; natural 1 above it still succeeds", () => {
    const hi = run(state(), check({ dc: 30 }), [20]);
    expect(checkOf(expectOk(hi.result))).toMatchObject({
      outcome: "failure",
      natural: 20,
    });
    const lo = run(state(), check({ expression: "1d20+20" }), [1]);
    expect(checkOf(expectOk(lo.result))).toMatchObject({
      outcome: "success",
      natural: 1,
    });
  });

  it("rolls an ability check with a skill and purpose check", () => {
    const { result } = run(
      state(),
      check({
        kind: "ability-check",
        ability: "wis",
        skill: "perception",
        dc: 10,
      }),
      [8],
    );
    const events = expectOk(result);
    expect(events[0]).toMatchObject({ purpose: "check" });
    expect(checkOf(events)).toMatchObject({
      kind: "ability-check",
      ability: "wis",
      skill: "perception",
      outcome: "success",
    });
  });

  it.each(SkillSchema.options)("rolls a check for the skill %s", (skill) => {
    const { result } = run(
      state(),
      check({ kind: "ability-check", ability: "wis", skill, dc: 10 }),
      [8],
    );
    expect(checkOf(expectOk(result))).toMatchObject({ skill });
  });

  it.each(["Perception", "sleight of hand", "spotting"])(
    "refuses the unlisted skill %s",
    (skill) => {
      const { result } = run(
        state(),
        check({ kind: "ability-check", ability: "wis", skill, dc: 10 }),
        [8],
      );
      expectRefusal(result, "INVALID_COMMAND");
    },
  );

  it("resolves a null or omitted skill", () => {
    const a = run(state(), check({ skill: null }), [8]);
    expect(checkOf(expectOk(a.result))).toMatchObject({ skill: null });
    const b = run(state(), check(), [8]);
    expect(checkOf(expectOk(b.result))).toMatchObject({ skill: null });
  });

  it("applies advantage", () => {
    const { result } = run(state(), check({ mode: "advantage" }), [2, 15]);
    expect(checkOf(expectOk(result))).toMatchObject({
      natural: 15,
      outcome: "success",
    });
  });

  it("allows a null combatant", () => {
    const { result } = run(stateWith(), check({ combatantId: null }), [11]);
    expect(checkOf(expectOk(result))).toMatchObject({ combatantId: null });
  });

  it("autoFail draws no die and emits only check.resolved", () => {
    const { result, counter } = run(
      state(),
      check({ autoFail: { reason: "paralyzed" } }),
    );
    const events = expectOk(result);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "check.resolved",
      outcome: "failure",
      dc: 13,
      autoFail: { reason: "paralyzed" },
      total: null,
      natural: null,
      rollIndex: null,
    });
    expect(counter.draws()).toBe(0);
  });

  it("autoFail still runs every precondition", () => {
    const autoFail = { reason: "paralyzed" };
    expectRefusedBeforeDraw(
      run(state(), check({ autoFail, expression: "1d6" })),
      "D20_TERM_REQUIRED",
    );
    expectRefusedBeforeDraw(
      run(state(), check({ autoFail, expression: "nope" })),
      "INVALID_DICE_EXPRESSION",
    );
    expectRefusedBeforeDraw(
      run(state(), check({ autoFail, combatantId: "ghost" })),
      "UNKNOWN_COMBATANT",
    );
  });

  it("refuses D20_TERM_REQUIRED", () => {
    for (const expression of ["2d20", "1d20kh1", "1d6+3", "1d20+1d20"]) {
      expectRefusedBeforeDraw(
        run(state(), check({ expression })),
        "D20_TERM_REQUIRED",
      );
    }
  });

  it("refuses unknown and dead combatants", () => {
    expectRefusedBeforeDraw(
      run(state(), check({ combatantId: "ghost" })),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(
          goblin({ lifeState: "dead", hp: { current: 0, max: 7, temp: 0 } }),
        ),
        check(),
      ),
      "TARGET_DEAD",
    );
  });

  it("refuses bad expressions and limits", () => {
    expectRefusedBeforeDraw(
      run(state(), check({ expression: "d" })),
      "INVALID_DICE_EXPRESSION",
    );
    expectRefusedBeforeDraw(
      run(state(), check({ expression: "1d20+1001" })),
      "DICE_LIMIT_EXCEEDED",
    );
  });
});

describe("attack to damage flow", () => {
  it("a critical hit feeds a critical damage.apply against a resistant target", () => {
    const target = goblin({
      hp: { current: 30, max: 30, temp: 0 },
      defenses: {
        resistances: ["slashing"],
        vulnerabilities: [],
        immunities: [],
      },
    });
    const s0 = stateWith(hero(), target);
    const hit = run(s0, attack(), [20]);
    const events = expectOk(hit.result);
    const resolved = outcomeOf(events);
    expect(resolved.outcome).toBe("critical-hit");
    const s1 = settle(s0, hit.result);

    const dmg = run(
      s1,
      {
        type: "damage.apply",
        targetId: "gob-1",
        components: [
          {
            amount: { kind: "roll", expression: "1d8+3" },
            damageType: "slashing",
          },
        ],
        critical: resolved.outcome === "critical-hit",
        defenses: null,
        reason: "scimitar crit",
      },
      [5, 6],
    );
    const dmgEvents = expectOk(dmg.result);
    expect(dmgEvents[0]).toMatchObject({
      type: "dice.rolled",
      critical: true,
      total: 14,
    });
    // Two d8 faces (doubled), +3 once = 14; resisted -> 7.
    expect(dmgEvents[1]).toMatchObject({
      rawAmount: 14,
      amount: 7,
      components: [{ raw: 14, applied: 7, adjustment: "resisted" }],
    });
    expect(dmg.rng.remaining()).toBe(0);
    expect(settle(s1, dmg.result).combatants["gob-1"]?.hp.current).toBe(23);
  });
});
