import { describe, expect, it } from "vitest";
import {
  type AttackEntry,
  bandOf,
  type Combatant,
  SkillSchema,
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

describe("derived rolls (spec 082)", () => {
  const stats = {
    abilityMods: { str: 3, wis: 3, dex: 2 },
    proficiencyBonus: 2,
    saves: {},
    skills: { athletics: 5 },
    attacks: [
      {
        name: "Longsword",
        range: "melee" as const,
        toHit: 5,
        damage: [
          {
            amount: { kind: "roll" as const, expression: "1d8+3" },
            damageType: "slashing" as const,
          },
        ],
      },
    ],
    spellcastingAbility: null,
  };
  const derivedHero = (over = {}) => hero({ stats, ...over });
  const dcheck = (over: Record<string, unknown> = {}) => ({
    type: "check.roll",
    combatantId: "pc-ana",
    kind: "ability-check",
    ability: "str",
    skill: "athletics",
    difficulty: "medium",
    reason: "climb",
    ...over,
  });
  const dattack = (over: Record<string, unknown> = {}) => ({
    type: "attack.roll",
    attackerId: "pc-ana",
    targetId: "gob-1",
    attack: "Longsword",
    reason: "swing",
    ...over,
  });

  it("derives a check at tier medium: 1d20+5 vs DC 15", () => {
    const out = run(stateWith(derivedHero(), goblin()), dcheck(), [10]);
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      expression: "1d20+5",
    });
    expect(checkOf(events)).toMatchObject({
      dc: 15,
      difficulty: "medium",
      total: 15,
      outcome: "success",
    });
  });
  it("rolls a scene check flat", () => {
    const out = run(
      stateWith(derivedHero(), goblin()),
      dcheck({ combatantId: null, difficulty: "hard" }),
      [12],
    );
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({ expression: "1d20" });
    expect(checkOf(events)).toMatchObject({ dc: 20, outcome: "failure" });
  });
  it("refuses dc with difficulty, and neither", () => {
    const st = stateWith(derivedHero(), goblin());
    expectRefusedBeforeDraw(
      run(st, dcheck({ dc: 15 }), [10]),
      "INVALID_COMMAND",
    );
    expectRefusedBeforeDraw(
      run(st, dcheck({ difficulty: undefined }), [10]),
      "INVALID_COMMAND",
    );
  });
  it("keeps explicit expression and dc, ignoring conditions", () => {
    const st = stateWith(
      derivedHero({ conditions: [cond("poisoned")] }),
      goblin(),
    );
    const out = run(
      st,
      dcheck({ expression: "1d20+1", dc: 12, difficulty: undefined }),
      [10],
    );
    expect(out.rng.remaining()).toBe(0);
    expect(checkOf(expectOk(out.result))).toMatchObject({ dc: 12, total: 11 });
  });
  it("rolls a poisoned check with disadvantage", () => {
    const st = stateWith(
      derivedHero({ conditions: [cond("poisoned")] }),
      goblin(),
    );
    const out = run(st, dcheck(), [18, 4]);
    expect(checkOf(expectOk(out.result)).total).toBe(9);
  });
  it("derives an attack by name against the record AC", () => {
    const out = run(stateWith(derivedHero(), goblin()), dattack(), [10]);
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({ expression: "1d20+5" });
    expect(outcomeOf(events)).toMatchObject({
      attack: "Longsword",
      ac: 15,
      total: 15,
      outcome: "hit",
    });
  });
  it("rolls a poisoned attacker with disadvantage", () => {
    const st = stateWith(
      derivedHero({ conditions: [cond("poisoned")] }),
      goblin(),
    );
    const out = run(st, dattack(), [18, 2]);
    expect(outcomeOf(expectOk(out.result)).total).toBe(7);
  });
  it("refuses attack with expression", () => {
    expectRefusedBeforeDraw(
      run(
        stateWith(derivedHero(), goblin()),
        dattack({ expression: "1d20" }),
        [10],
      ),
      "INVALID_COMMAND",
    );
  });
  it("refuses STAT_UNDEFINED before any draw", () => {
    expectRefusedBeforeDraw(
      run(stateWith(hero(), goblin()), dattack(), [10]),
      "STAT_UNDEFINED",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(derivedHero(), goblin()),
        dattack({ attack: "Warhammer" }),
        [10],
      ),
      "STAT_UNDEFINED",
    );
    expectRefusedBeforeDraw(
      run(stateWith(hero(), goblin()), dcheck(), [10]),
      "STAT_UNDEFINED",
    );
    expectRefusedBeforeDraw(
      run(
        stateWith(derivedHero(), goblin()),
        dcheck({ ability: "int", skill: null }),
        [10],
      ),
      "STAT_UNDEFINED",
    );
  });
  it("bands against the tier DC", () => {
    // 1d20+5 total 14 vs DC 15: margin -1
    const out = run(stateWith(derivedHero(), goblin()), dcheck(), [9]);
    const e = checkOf(expectOk(out.result));
    expect(e).toMatchObject({ dc: 15, margin: -1 });
  });
});

describe("opposition and assists (spec 084)", () => {
  const mkStats = (over = {}) => ({
    abilityMods: { str: 3, dex: 2, wis: 0 },
    proficiencyBonus: 2,
    saves: {},
    skills: { athletics: 5, acrobatics: 4 },
    attacks: [
      {
        name: "Fist",
        range: "melee" as const,
        toHit: 5,
        damage: [],
      },
    ],
    spellcastingAbility: null,
    ...over,
  });
  const snag = (over = {}) =>
    goblin({
      stats: mkStats({ abilityMods: { str: -1 }, skills: {} }),
      ...over,
    });
  const opp = (over: Record<string, unknown> = {}) => ({
    type: "check.roll",
    combatantId: "pc-ana",
    kind: "ability-check",
    ability: "str",
    skill: "athletics",
    opposition: { opponentId: "gob-1", rule: "unarmed-strike" },
    reason: "break the grapple",
    ...over,
  });
  const st = (h = {}, g = {}) =>
    stateWith(hero({ stats: mkStats(), ...h }), snag(g));

  it("records the derived DC and opposition", () => {
    const events = expectOk(run(st(), opp(), [10]).result);
    expect(checkOf(events)).toMatchObject({
      dc: 9,
      opposition: { opponentId: "gob-1", rule: "unarmed-strike" },
    });
  });
  it("applies spec 070's band on a derived opposition DC", () => {
    const events = expectOk(
      run(
        st(),
        opp({ houseRules: { outcomeBands: true, naturals: false } }),
        [2],
      ).result,
    );
    // total 2 + 5 = 7 vs DC 9: margin -2, success at a cost
    expect(checkOf(events)).toMatchObject({
      margin: -2,
      band: "success-at-cost",
    });
  });
  it("refuses bad opposition before any draw", () => {
    const s = st();
    expectRefusedBeforeDraw(run(s, opp({ dc: 10 }), [10]), "INVALID_COMMAND");
    expectRefusedBeforeDraw(
      run(
        s,
        opp({ opposition: { opponentId: "pc-ana", rule: "unarmed-strike" } }),
        [10],
      ),
      "INVALID_COMMAND",
    );
    expectRefusedBeforeDraw(
      run(s, opp({ skill: "stealth", ability: "dex" }), [10]),
      "INVALID_COMMAND",
    );
    expectRefusedBeforeDraw(
      run(
        s,
        opp({ opposition: { opponentId: "nobody", rule: "unarmed-strike" } }),
        [10],
      ),
      "UNKNOWN_COMBATANT",
    );
    expectRefusedBeforeDraw(
      run(
        st({}, { lifeState: "dead", hp: { current: 0, max: 7, temp: 0 } }),
        opp(),
        [10],
      ),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(stateWith(hero({ stats: mkStats() }), goblin()), opp(), [10]),
      "STAT_UNDEFINED",
    );
  });

  const ath = {
    kind: "ability-check",
    helperId: "h",
    skill: "athletics",
    expiresAt: null,
  };
  const dcheck = (over: Record<string, unknown> = {}) => ({
    type: "check.roll",
    combatantId: "pc-ana",
    kind: "ability-check",
    ability: "str",
    skill: "athletics",
    difficulty: "medium",
    reason: "shove",
    ...over,
  });
  const assisted = (assists: unknown[] = [ath], over = {}) =>
    stateWith(
      hero({ stats: mkStats(), assists: assists as never, ...over }),
      snag(),
    );

  it("an ability-check assist rolls advantage and ends used", () => {
    const out = run(assisted(), dcheck(), [3, 15]);
    const events = expectOk(out.result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      mode: "advantage",
      total: 20,
    });
    expect(events.at(-1)).toMatchObject({
      type: "assist.ended",
      cause: "used",
      combatantId: "pc-ana",
    });
    expect(
      settle(assisted(), out.result).combatants["pc-ana"]?.assists,
    ).toEqual([]);
  });
  it("a different skill and a saving throw leave the assist", () => {
    const other = expectOk(
      run(assisted(), dcheck({ skill: "acrobatics", ability: "dex" }), [10])
        .result,
    );
    expect(other.some((e) => e.type === "assist.ended")).toBe(false);
    const save = expectOk(
      run(assisted(), dcheck({ kind: "saving-throw", skill: null }), [10])
        .result,
    );
    expect(save.some((e) => e.type === "assist.ended")).toBe(false);
  });
  it("an assist plus disadvantage rolls normal and is still used", () => {
    const events = expectOk(
      run(assisted([ath], { conditions: [cond("poisoned")] }), dcheck(), [10])
        .result,
    );
    expect(events[0]).toMatchObject({ mode: "normal" });
    expect(events.at(-1)).toMatchObject({
      type: "assist.ended",
      cause: "used",
    });
  });
  it("two assists give advantage once and both end", () => {
    const two = [ath, { ...ath, helperId: "h2" }];
    const events = expectOk(run(assisted(two), dcheck(), [3, 15]).result);
    expect(events[0]).toMatchObject({ mode: "advantage" });
    expect(events.filter((e) => e.type === "assist.ended")).toHaveLength(2);
  });
  it("auto-fail, auto-success and explicit expression leave the assist", () => {
    for (const over of [
      { autoFail: { reason: "stuck" } },
      { autoSuccess: { reason: "retry" } },
      { expression: "1d20+1" },
    ]) {
      const events = expectOk(run(assisted(), dcheck(over), [10]).result);
      expect(events.some((e) => e.type === "assist.ended")).toBe(false);
    }
  });
  it("an attack assist applies to another attacker, not the helper", () => {
    const atk = { kind: "attack", helperId: "h", expiresAt: null };
    const s = stateWith(hero({ stats: mkStats() }), snag({ assists: [atk] }));
    const dattack = (attackerId: string) => ({
      type: "attack.roll",
      attackerId,
      targetId: "gob-1",
      attack: "Fist",
      reason: "swing",
    });
    const events = expectOk(run(s, dattack("pc-ana"), [3, 15]).result);
    expect(events[0]).toMatchObject({ mode: "advantage" });
    expect(events.at(-1)).toMatchObject({
      type: "assist.ended",
      cause: "used",
      combatantId: "gob-1",
    });
    const helper = stateWith(
      makeCombatant({ id: "h", name: "H", stats: mkStats() }),
      snag({ assists: [atk] }),
    );
    const own = expectOk(run(helper, dattack("h"), [10]).result);
    expect(own[0]).toMatchObject({ mode: "normal" });
    expect(own.some((e) => e.type === "assist.ended")).toBe(false);
  });
});

describe("attack.roll bands (spec 094)", () => {
  const zone = (id: string) => ({
    id,
    name: id,
    kind: "room",
    tags: [],
    hidden: false,
  });
  const space = {
    zones: ["a", "b", "c", "d"].map(zone),
    edges: [
      { from: "a", to: "b", kind: "open", feet: 20 },
      { from: "b", to: "c", kind: "open", feet: 20 },
    ],
  };
  const stats = (attacks: AttackEntry[]) => ({
    abilityMods: {},
    proficiencyBonus: 2,
    saves: {},
    skills: {},
    attacks,
    spellcastingAbility: null,
  });
  const sword: AttackEntry = {
    name: "Sword",
    range: "melee",
    toHit: 5,
    damage: [],
  };
  const bow: AttackEntry = {
    name: "Bow",
    range: "ranged",
    toHit: 5,
    damage: [],
    rangeFt: { normal: 80, long: 320 },
  };
  const short: AttackEntry = {
    ...bow,
    name: "Short",
    rangeFt: { normal: 20, long: 60 },
  };
  const either: AttackEntry = {
    ...bow,
    name: "Either",
    range: "melee-or-ranged",
  };
  const noRange: AttackEntry = {
    name: "Sling",
    range: "ranged",
    toHit: 5,
    damage: [],
  };
  const setup = (attackerZone: string | null, targetZone: string | null) => {
    const base = stateWith(
      makeCombatant({
        id: "atk",
        stats: stats([sword, bow, short, either, noRange]),
      }),
      makeCombatant({ id: "tgt" }),
    );
    let state = settle(
      base,
      run(base, { type: "space.define", space, reason: "s" }).result,
    );
    for (const [id, z] of [
      ["atk", attackerZone],
      ["tgt", targetZone],
    ] as const) {
      if (z)
        state = settle(
          state,
          run(state, {
            type: "combatant.place",
            combatantId: id,
            zoneId: z,
            reason: "p",
          }).result,
        );
    }
    return state;
  };
  const swing = (attack: string, over = {}) => ({
    type: "attack.roll",
    attackerId: "atk",
    targetId: "tgt",
    attack,
    reason: "swing",
    ...over,
  });

  it("resolves a melee entry against an engaged target", () => {
    const out = run(setup("a", "a"), swing("Sword"), [10]);
    expectOk(out.result);
    expect(out.counter.draws()).toBe(1);
  });
  it("refuses OUT_OF_REACH for a melee entry at near, before a draw", () => {
    expectRefusedBeforeDraw(
      run(setup("a", "b"), swing("Sword"), [10]),
      "OUT_OF_REACH",
    );
  });
  it("rolls a ranged entry at far with disadvantage (80/320 at 120 ft)", () => {
    const out = run(setup("a", "c"), swing("Bow"), [15, 3]);
    const [dice] = expectOk(out.result);
    expect(dice).toMatchObject({ mode: "disadvantage", natural: 3 });
  });
  it("rolls a ranged entry at near without disadvantage", () => {
    const out = run(setup("a", "b"), swing("Bow"), [15]);
    expect(expectOk(out.result)[0]).toMatchObject({ mode: "normal" });
  });
  it("refuses OUT_OF_RANGE for 20/60 at far, and for an unreachable zone", () => {
    expectRefusedBeforeDraw(
      run(setup("a", "c"), swing("Short"), [10]),
      "OUT_OF_RANGE",
    );
    expectRefusedBeforeDraw(
      run(setup("a", "d"), swing("Bow"), [10]),
      "OUT_OF_RANGE",
    );
  });
  it("treats melee-or-ranged as melee when engaged and ranged otherwise", () => {
    expectOk(run(setup("a", "a"), swing("Either"), [10]).result);
    const far = run(setup("a", "c"), swing("Either"), [15, 3]);
    expect(expectOk(far.result)[0]).toMatchObject({ mode: "disadvantage" });
  });
  it("refuses STAT_UNDEFINED for a placed ranged entry without rangeFt", () => {
    expectRefusedBeforeDraw(
      run(setup("a", "b"), swing("Sling"), [10]),
      "STAT_UNDEFINED",
    );
  });
  it("skips band checks when unplaced, spaceless, or an explicit expression", () => {
    expectOk(run(setup("a", null), swing("Sword"), [10]).result);
    expectOk(run(setup(null, "a"), swing("Sword"), [10]).result);
    const base = stateWith(
      makeCombatant({ id: "atk", stats: stats([sword]) }),
      makeCombatant({ id: "tgt" }),
    );
    expectOk(run(base, swing("Sword"), [10]).result);
    const far = run(
      setup("a", "d"),
      swing("", { attack: undefined, expression: "1d20+5" }),
      [10],
    );
    expectOk(far.result);
  });
});

describe("ranged attacks in close combat (spec 099)", () => {
  // SRD 5.2.1 playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat
  const zone = (id: string) => ({
    id,
    name: id,
    kind: "room",
    tags: [],
    hidden: false,
  });
  const space = {
    zones: ["a", "b"].map(zone),
    edges: [{ from: "a", to: "b", kind: "open", feet: 20 }],
  };
  const entry = (
    name: string,
    range: "melee" | "ranged" | "melee-or-ranged",
  ): AttackEntry => ({
    name,
    range,
    toHit: 5,
    damage: [],
    rangeFt: { normal: 80, long: 320 },
  });
  const stats = {
    abilityMods: {},
    proficiencyBonus: 2,
    saves: {},
    skills: {},
    attacks: [
      entry("Sword", "melee"),
      entry("Bow", "ranged"),
      entry("Either", "melee-or-ranged"),
    ],
    spellcastingAbility: null,
  };
  const cond = (condition: string) => ({
    instanceId: `c-${condition}`,
    condition: condition as Combatant["conditions"][number]["condition"],
    level: null,
    source: "t",
    expiresAt: null,
  });
  // atk (party) in a; tgt (hostile) in foeZone; far (hostile) in b.
  const setup = (sides: boolean, foeZone = "a", foeOver = {}) => {
    const base = stateWith(
      makeCombatant({
        id: "atk",
        ...(sides ? { side: "party" as const } : {}),
        stats,
      }),
      makeCombatant({
        id: "tgt",
        ...(sides ? { side: "hostile" as const } : {}),
        ...foeOver,
      }),
      makeCombatant({
        id: "far",
        ...(sides ? { side: "hostile" as const } : {}),
      }),
    );
    let state = settle(
      base,
      run(base, { type: "space.define", space, reason: "s" }).result,
    );
    for (const [id, z] of [
      ["atk", "a"],
      ["tgt", foeZone],
      ["far", "b"],
    ] as const) {
      state = settle(
        state,
        run(state, {
          type: "combatant.place",
          combatantId: id,
          zoneId: z,
          reason: "p",
        }).result,
      );
    }
    return state;
  };
  const swing = (attack: string, targetId = "tgt") => ({
    type: "attack.roll",
    attackerId: "atk",
    targetId,
    attack,
    reason: "swing",
  });
  const modeOf = (
    state: Parameters<typeof run>[0],
    cmd: unknown,
    faces: number[],
  ) => expectOk(run(state, cmd, faces).result)[0];

  it("a ranged attack with a hostile in the attacker's zone has disadvantage", () => {
    expect(modeOf(setup(true), swing("Bow"), [15, 3])).toMatchObject({
      mode: "disadvantage",
      natural: 3,
    });
  });
  it("applies to a ranged attack on a target elsewhere while a foe is engaged", () => {
    expect(modeOf(setup(true), swing("Bow", "far"), [15, 3])).toMatchObject({
      mode: "disadvantage",
    });
  });
  it("melee does not", () => {
    expect(modeOf(setup(true), swing("Sword"), [15])).toMatchObject({
      mode: "normal",
    });
  });
  it("melee-or-ranged against an engaged target is melee", () => {
    expect(modeOf(setup(true), swing("Either"), [15])).toMatchObject({
      mode: "normal",
    });
  });
  it("no sides means no rule", () => {
    expect(modeOf(setup(false), swing("Bow"), [15])).toMatchObject({
      mode: "normal",
    });
  });
  it("a foe in another zone does not trigger it", () => {
    expect(modeOf(setup(true, "b"), swing("Bow"), [15])).toMatchObject({
      mode: "normal",
    });
  });
  it("an incapacitated foe does not trigger it", () => {
    const st = setup(true, "a", { conditions: [cond("incapacitated")] });
    expect(modeOf(st, swing("Bow", "far"), [15])).toMatchObject({
      mode: "normal",
    });
  });
  it("cancels against advantage (stunned far target)", () => {
    const st = setup(true);
    st.combatants.far = {
      ...(st.combatants.far as Combatant),
      conditions: [cond("stunned")],
    };
    expect(modeOf(st, swing("Bow", "far"), [15])).toMatchObject({
      mode: "normal",
    });
  });
});
