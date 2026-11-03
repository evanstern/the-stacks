import { describe, expect, it } from "vitest";
import { bandOf, SkillSchema } from "../../src/index.js";
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

const cond = (condition: string) => ({
  instanceId: `c-${condition}`,
  condition,
  level: null,
  source: "test",
  expiresAt: null,
});

describe("ACTOR_UNABLE", () => {
  it("refuses an unconscious or stable attacker before any draw", () => {
    for (const lifeState of ["unconscious", "stable"] as const) {
      const out = run(
        stateWith(
          hero({ lifeState, hp: { current: 0, max: 12, temp: 0 } }),
          goblin(),
        ),
        attack(),
        [10],
      );
      expectRefusedBeforeDraw(out, "ACTOR_UNABLE");
      expect(out.rng.remaining()).toBe(1);
      expect(out.result.ok === false && out.result.refusal.details).toEqual({
        combatantId: "pc-ana",
        role: "attacker",
        lifeState,
        conditions: [],
      });
    }
  });

  it("refuses an attacker with an incapacitating condition", () => {
    for (const key of [
      "incapacitated",
      "paralyzed",
      "petrified",
      "stunned",
      "unconscious",
    ]) {
      const out = run(
        stateWith(hero({ conditions: [cond(key)] as never }), goblin()),
        attack(),
        [10],
      );
      expectRefusedBeforeDraw(out, "ACTOR_UNABLE");
      expect(
        out.result.ok === false && out.result.refusal.details,
      ).toMatchObject({ role: "attacker", conditions: [key] });
    }
  });

  it("refuses an unable ability checker", () => {
    const out = run(
      stateWith(
        hero({
          lifeState: "unconscious",
          hp: { current: 0, max: 12, temp: 0 },
        }),
      ),
      check({ combatantId: "pc-ana", kind: "ability-check" }),
      [10],
    );
    expectRefusedBeforeDraw(out, "ACTOR_UNABLE");
    expect(out.result.ok === false && out.result.refusal.details).toMatchObject(
      { combatantId: "pc-ana", role: "checker", lifeState: "unconscious" },
    );
  });

  it("accepts an unable saving thrower", () => {
    const { result } = run(
      stateWith(
        hero({
          lifeState: "unconscious",
          hp: { current: 0, max: 12, temp: 0 },
        }),
      ),
      check({ combatantId: "pc-ana", kind: "saving-throw" }),
      [10],
    );
    expect(result.ok).toBe(true);
  });

  it("still refuses a dead attacker with TARGET_DEAD", () => {
    expectRefusedBeforeDraw(
      run(
        stateWith(
          hero({ lifeState: "dead", hp: { current: 0, max: 12, temp: 0 } }),
          goblin(),
        ),
        attack(),
      ),
      "TARGET_DEAD",
    );
  });

  it("checks no one when the ids are null", () => {
    const { result } = run(
      stateWith(goblin()),
      attack({ attackerId: null }),
      [10],
    );
    expect(result.ok).toBe(true);
    const checked = run(
      stateWith(goblin()),
      check({ combatantId: null, kind: "ability-check" }),
      [10],
    );
    expect(checked.result.ok).toBe(true);
  });

  it("accepts an unconscious target", () => {
    const { result } = run(
      stateWith(
        hero(),
        goblin({
          lifeState: "unconscious",
          hp: { current: 0, max: 7, temp: 0 },
        }),
      ),
      attack(),
      [10],
    );
    expect(result.ok).toBe(true);
  });
});

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

describe("check.roll outcome bands (spec 070)", () => {
  const on = { outcomeBands: true, naturals: true };
  const bandsOnly = { outcomeBands: true, naturals: false };
  // Ability check, 1d20+0 against DC 12: the face is the total.
  const ability = (over: Record<string, unknown> = {}) =>
    check({
      kind: "ability-check",
      ability: "cha",
      combatantId: "pc-ana",
      expression: "1d20+0",
      dc: 12,
      ...over,
    });
  const bandFor = (face: number, houseRules: object, over = {}) =>
    checkOf(
      expectOk(run(state(), ability({ houseRules, ...over }), [face]).result),
    );

  it.each([
    [12, 0, "success", "success"],
    [11, -1, "success-at-cost", "success"],
    [10, -2, "success-at-cost", "success"],
    [9, -3, "failure", "failure"],
    [8, -4, "failure", "failure"],
    [7, -5, "severe-failure", "failure"],
  ])(
    "face %i (margin %i) with bands on is %s",
    (face, margin, band, outcome) => {
      expect(bandFor(face, bandsOnly)).toMatchObject({ margin, band, outcome });
    },
  );

  it("bands off: a miss is a plain failure at any margin", () => {
    expect(bandFor(11, { outcomeBands: false, naturals: false })).toMatchObject(
      { margin: -1, band: "failure", outcome: "failure" },
    );
    expect(bandFor(2, { outcomeBands: false, naturals: false })).toMatchObject({
      band: "failure",
    });
  });

  it("a saving throw never gets a cost or severe band", () => {
    const save = (face: number) =>
      checkOf(
        expectOk(run(state(), check({ houseRules: bandsOnly }), [face]).result),
      );
    expect(save(9)).toMatchObject({ margin: -2, band: "failure" });
    expect(save(5)).toMatchObject({ margin: -6, band: "failure" });
  });

  it("natural 20 below the DC succeeds and natural 1 above it fails (naturals on)", () => {
    expect(bandFor(20, on, { dc: 30 })).toMatchObject({
      band: "success",
      outcome: "success",
    });
    expect(bandFor(1, on, { expression: "1d20+20", dc: 12 })).toMatchObject({
      band: "failure",
      outcome: "failure",
    });
  });

  it("naturals off: the total decides", () => {
    expect(
      bandFor(20, { outcomeBands: false, naturals: false }, { dc: 30 }),
    ).toMatchObject({ outcome: "failure" });
  });

  it("natural 1 at margin -6 with bands on is a severe failure", () => {
    expect(bandFor(1, on, { dc: 7 })).toMatchObject({
      margin: -6,
      band: "severe-failure",
    });
  });

  it("autoSuccess resolves success with no dice and no draw", () => {
    const { result, rng } = run(
      state(),
      ability({ autoSuccess: { reason: "free retry" } }),
      [],
    );
    const events = expectOk(result);
    expect(events.map((e) => e.type)).toEqual(["check.resolved"]);
    expect(checkOf(events)).toMatchObject({
      outcome: "success",
      band: "success",
      margin: null,
      total: null,
      natural: null,
    });
    expect(rng.remaining()).toBe(0);
  });

  it("refuses autoSuccess beside autoFail", () => {
    expectRefusedBeforeDraw(
      run(
        state(),
        ability({
          autoSuccess: { reason: "a" },
          autoFail: { reason: "b" },
        }),
        [10],
      ),
      "INVALID_COMMAND",
    );
  });

  it("autoFail records band failure and a null margin", () => {
    const { result } = run(
      state(),
      ability({ autoFail: { reason: "locked" } }),
      [],
    );
    expect(checkOf(expectOk(result))).toMatchObject({
      band: "failure",
      margin: null,
    });
  });

  it("sending no houseRules gives SRD behaviour", () => {
    expect(
      checkOf(expectOk(run(state(), ability(), [11]).result)),
    ).toMatchObject({ band: "failure", outcome: "failure", margin: -1 });
  });

  it("bandOf is pure", () => {
    expect(
      bandOf({
        total: 10,
        dc: 12,
        natural: 10,
        kind: "ability-check",
        houseRules: bandsOnly,
      }).band,
    ).toBe("success-at-cost");
  });
});
