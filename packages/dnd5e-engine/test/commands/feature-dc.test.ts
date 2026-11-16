import { describe, expect, it } from "vitest";
import type { EngineState, FeatureDc } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

// Spec 120: a save against a monster feature uses the DC the stat block states.
const stats = (over = {}) => ({
  abilityMods: { str: 3, dex: 3, con: 1, int: 0, wis: 1, cha: 0 },
  proficiencyBonus: 2,
  saves: {},
  skills: { athletics: 5 },
  attacks: [],
  spellcastingAbility: null,
  ...over,
});
const web: FeatureDc = { kind: "save", feature: "Web", ability: "dex", dc: 13 };
const aboleth: FeatureDc[] = [
  { kind: "save", feature: "Mucus Cloud", ability: "con", dc: 14 },
  { kind: "escape", feature: "Tentacle", dc: 14 },
  { kind: "save", feature: "Consume Memories", ability: "int", dc: 16 },
  { kind: "save", feature: "Dominate Mind", ability: "wis", dc: 16 },
];
const world = (): EngineState =>
  stateWith(
    makeCombatant({ id: "ana", name: "Ana", stats: stats() }),
    makeCombatant({
      id: "spider",
      name: "Spider",
      stats: stats({ featureDcs: [web] }),
    }),
    makeCombatant({
      id: "mephit",
      name: "Mephit",
      zeroHpRule: "dies",
      hp: { current: 18, max: 18, temp: 0 },
      stats: stats({
        featureDcs: [
          { kind: "save", feature: "Death Burst", ability: "dex", dc: 11 },
          { kind: "save", feature: "Fire Breath", ability: "dex", dc: 11 },
        ],
      }),
    }),
    makeCombatant({
      id: "aboleth",
      name: "Aboleth",
      stats: stats({
        abilityMods: { str: 5, dex: 3, con: 1, int: 0, wis: 1, cha: 0 },
        proficiencyBonus: 4,
        featureDcs: aboleth,
      }),
    }),
    makeCombatant({ id: "rock", name: "Rock" }),
  );
const save = (over: Record<string, unknown> = {}) => ({
  type: "check.roll",
  combatantId: "ana",
  kind: "saving-throw",
  ability: "dex",
  feature: { sourceId: "spider", name: "Web" },
  reason: "the web",
  ...over,
});
const resolved = (events: ReturnType<typeof expectOk>) => {
  const e = events.find((x) => x.type === "check.resolved");
  if (e?.type !== "check.resolved") throw new Error("no check.resolved");
  return e;
};

describe("check.roll feature DC (spec 120)", () => {
  it("meets the DC on a 10", () => {
    const e = resolved(expectOk(run(world(), save(), [10]).result));
    expect(e).toMatchObject({
      dc: 13,
      total: 13,
      natural: 10,
      outcome: "success",
      feature: { sourceId: "spider", name: "Web" },
    });
    expect("difficulty" in e).toBe(false);
  });
  it("fails on a 9", () => {
    expect(resolved(expectOk(run(world(), save(), [9]).result))).toMatchObject({
      dc: 13,
      total: 12,
      outcome: "failure",
    });
  });
  it("matches the name trimmed and case-insensitive", () => {
    const e = resolved(
      expectOk(
        run(
          world(),
          save({ feature: { sourceId: "spider", name: "  web " } }),
          [10],
        ).result,
      ),
    );
    expect(e.feature).toEqual({ sourceId: "spider", name: "Web" });
  });
  it("keeps an explicit expression", () => {
    expect(
      resolved(
        expectOk(run(world(), save({ expression: "1d20+3" }), [10]).result),
      ),
    ).toMatchObject({ dc: 13, outcome: "success" });
  });
  it("records the DC and feature on a spec 119 auto-fail, no draw", () => {
    const base = world();
    const afterCond = settle(
      base,
      run(base, {
        type: "condition.apply",
        targetId: "ana",
        condition: "paralyzed",
        source: "test",
        reason: "held",
      }).result,
    );
    const out = run(afterCond, save(), [10]);
    const e = resolved(expectOk(out.result));
    expect(out.counter.draws()).toBe(0);
    expect(e).toMatchObject({
      dc: 13,
      outcome: "failure",
      feature: { sourceId: "spider", name: "Web" },
    });
    expect(e.autoFail).not.toBeNull();
  });
  it("allows a dead source", () => {
    const base = world();
    const dead = settle(
      base,
      run(base, {
        type: "damage.apply",
        targetId: "mephit",
        components: [
          { amount: { kind: "fixed", value: 30 }, damageType: "fire" },
        ],
        reason: "slain",
      }).result,
    );
    const e = resolved(
      expectOk(
        run(
          dead,
          save({ feature: { sourceId: "mephit", name: "Death Burst" } }),
          [8],
        ).result,
      ),
    );
    expect(e).toMatchObject({ dc: 11, outcome: "success" });
  });
});

describe("check.roll feature refusals (spec 120)", () => {
  it("refuses a second DC source", () => {
    expectRefusedBeforeDraw(
      run(world(), save({ difficulty: "medium" }), [10]),
      "INVALID_COMMAND",
    );
  });
  it("refuses an ability check", () => {
    expectRefusedBeforeDraw(
      run(world(), save({ kind: "ability-check" }), [10]),
      "INVALID_COMMAND",
    );
  });
  it("refuses the source as the checker", () => {
    expectRefusedBeforeDraw(
      run(world(), save({ combatantId: "spider" }), [10]),
      "INVALID_COMMAND",
    );
  });
  it("refuses an unknown source", () => {
    expectRefusedBeforeDraw(
      run(world(), save({ feature: { sourceId: "ghost", name: "Web" } }), [10]),
      "UNKNOWN_COMBATANT",
    );
  });
  it("refuses a source with no stats", () => {
    const out = run(
      world(),
      save({ feature: { sourceId: "rock", name: "Web" } }),
      [10],
    );
    expectRefusedBeforeDraw(out, "STAT_UNDEFINED");
    if (!out.result.ok) {
      expect(out.result.refusal.details).toMatchObject({ missing: "stats" });
    }
  });
  it("refuses an unnamed feature", () => {
    const out = run(
      world(),
      save({ feature: { sourceId: "spider", name: "Bite" } }),
      [10],
    );
    expectRefusedBeforeDraw(out, "STAT_UNDEFINED");
    if (!out.result.ok) {
      expect(out.result.refusal.details).toMatchObject({
        missing: 'feature "Bite"',
      });
    }
  });
  it("refuses an escape-only entry", () => {
    expectRefusedBeforeDraw(
      run(
        world(),
        save({ feature: { sourceId: "aboleth", name: "Tentacle" } }),
        [10],
      ),
      "STAT_UNDEFINED",
    );
  });
  it("refuses the wrong ability and names the right one", () => {
    const out = run(world(), save({ ability: "con" }), [10]);
    expectRefusedBeforeDraw(out, "INVALID_COMMAND");
    if (!out.result.ok) {
      expect(out.result.refusal.details).toMatchObject({ ability: "dex" });
    }
  });
});

describe("escape DC through opposition (spec 120)", () => {
  const opposed = (over: Record<string, unknown>) => ({
    type: "check.roll",
    combatantId: "ana",
    opposition: { opponentId: "aboleth", rule: "unarmed-strike" },
    reason: "break free",
    ...over,
  });
  it("an Athletics check meets the stated escape DC 14", () => {
    const e = resolved(
      expectOk(
        run(
          world(),
          opposed({
            kind: "ability-check",
            ability: "str",
            skill: "athletics",
          }),
          [9],
        ).result,
      ),
    );
    expect(e).toMatchObject({ dc: 14, total: 14, outcome: "success" });
  });
  it("a Strength save keeps the formula DC 17", () => {
    const e = resolved(
      expectOk(
        run(world(), opposed({ kind: "saving-throw", ability: "str" }), [14])
          .result,
      ),
    );
    expect(e).toMatchObject({ dc: 17, total: 17, outcome: "success" });
  });
});
