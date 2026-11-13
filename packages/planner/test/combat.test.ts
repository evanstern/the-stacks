import { describe, expect, it } from "vitest";
import { type PlanResult, plan } from "../src/index.js";
import {
  actors,
  baseState,
  inEncounter,
  intent,
  patchStats,
  placeAt,
  tgt,
  view,
  withCombatant,
  zone,
} from "./fixtures.js";

const run = (i: ReturnType<typeof intent>, s = baseState()) =>
  plan(s, view(s), i);
const cmds = (r: PlanResult) => {
  expect(r.kind).toBe("commands");
  return r.kind === "commands" ? r : (undefined as never);
};
const refusal = (r: PlanResult) => {
  expect(r.kind).toBe("refusal");
  return r.kind === "refusal" ? r.refusal : (undefined as never);
};
const near = () => placeAt(baseState(), "goblin-2", "b");
const hit = (extra: Record<string, unknown> = {}) =>
  intent("attack", {
    targets: [tgt("goblin-2")],
    params: { weapon: "Longsword" },
    ...extra,
  });

describe("attack", () => {
  it("melee in the engaged band: attack.roll then guarded damage", () => {
    const r = cmds(run(hit()));
    expect(r.commands.map((c) => c.command.type)).toEqual([
      "attack.roll",
      "damage.apply",
      "damage.apply",
    ]);
    expect(r.commands[0]?.command).toMatchObject({
      type: "attack.roll",
      attackerId: "thorin",
      targetId: "goblin-2",
      attack: "Longsword",
      mode: "normal",
    });
    expect(r.commands[1]).toMatchObject({
      command: {
        type: "damage.apply",
        targetId: "goblin-2",
        critical: false,
        components: [
          {
            amount: { kind: "roll", expression: "1d8+3" },
            damageType: "slashing",
          },
        ],
      },
      when: { step: 0, outcomes: ["hit"] },
    });
    expect(r.commands[2]).toMatchObject({
      command: { critical: true },
      when: { step: 0, outcomes: ["critical-hit"] },
    });
    expect(r.facts).toEqual([{ kind: "reach", band: "engaged", use: "melee" }]);
  });

  it("refuses OUT_OF_REACH for a melee use at near", () => {
    const s = near();
    const f = refusal(run(hit(), s));
    expect([f.source, f.code]).toEqual(["planner", "OUT_OF_REACH"]);
  });

  it("ranged: normal range, then long range", () => {
    const s = near();
    const bow = hit({ params: { weapon: "Shortbow" } });
    expect(cmds(run(bow, s)).facts).toEqual([
      { kind: "reach", band: "near", use: "normal" },
    ]);
    patchStats(s, "thorin", {
      attacks: [
        {
          name: "Shortbow",
          range: "ranged",
          rangeFt: { normal: 20, long: 60 },
          toHit: 3,
          damage: [],
        },
      ],
    });
    const r = cmds(run(bow, s));
    expect(r.facts).toEqual([{ kind: "reach", band: "near", use: "long" }]);
    expect(r.commands).toHaveLength(1);
  });

  it("refuses OUT_OF_RANGE beyond long range", () => {
    const s = baseState();
    placeAt(s, "goblin-2", "c");
    patchStats(s, "thorin", {
      attacks: [
        {
          name: "Shortbow",
          range: "ranged",
          rangeFt: { normal: 5, long: 20 },
          toHit: 3,
          damage: [],
        },
      ],
    });
    const f = refusal(run(hit({ params: { weapon: "Shortbow" } }), s));
    expect(f.code).toBe("OUT_OF_RANGE");
  });

  it("skips the band checks when a side is unplaced", () => {
    const s = baseState();
    delete (s.engine.combatants["goblin-2"] as { placement?: unknown })
      .placement;
    s.engine.space = undefined;
    const r = cmds(run(hit(), s));
    expect(r.facts).toEqual([]);
  });

  it("refuses STAT_UNDEFINED for a missing entry", () => {
    const f = refusal(run(hit({ params: { weapon: "Warhammer" } })));
    expect([f.source, f.code]).toEqual(["engine", "STAT_UNDEFINED"]);
  });

  it("plans a derived Unarmed Strike with fixed bludgeoning damage (spec 109)", () => {
    const r = cmds(run(hit({ params: { weapon: "unarmed" } })));
    expect(r.commands[0]?.command).toMatchObject({
      type: "attack.roll",
      attack: "Unarmed Strike",
    });
    const dmg = r.commands.slice(1);
    expect(dmg.map((c) => c.when)).toMatchObject([
      { step: 0, outcomes: ["hit"] },
      { step: 0, outcomes: ["critical-hit"] },
    ]);
    for (const c of dmg)
      expect(c.command).toMatchObject({
        type: "damage.apply",
        components: [
          {
            amount: { kind: "fixed", value: expect.any(Number) },
            damageType: "bludgeoning",
          },
        ],
      });
  });

  it("an attack with no damage entries plans the roll alone", () => {
    const s = baseState();
    patchStats(s, "thorin", {
      attacks: [
        { name: "Touch", range: "melee", reachFt: 5, toHit: 1, damage: [] },
      ],
    });
    const r = cmds(run(hit({ params: { weapon: "Touch" } }), s));
    expect(r.commands).toHaveLength(1);
  });

  it("pulls in an NPC target first, in an encounter with a join", () => {
    const s = inEncounter(baseState(), ["thorin", "goblin-2"]);
    const r = cmds(run(hit({ targets: [tgt("orc-1")] }), s));
    expect(r.commands.map((c) => c.command.type)).toEqual([
      "combatant.add",
      "initiative.join",
      "attack.roll",
      "damage.apply",
      "damage.apply",
    ]);
    expect(r.commands[3]?.when?.step).toBe(2);
  });

  it("is deterministic", () => {
    expect(run(hit())).toEqual(run(hit()));
  });
});

describe("close-combat fact", () => {
  const RULE = {
    kind: "rule",
    rule: "playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat",
  };
  const sided = () => {
    const s = baseState();
    for (const [id, side] of [
      ["thorin", "party"],
      ["goblin-2", "hostile"],
    ] as const) {
      s.engine.combatants[id] = { ...s.engine.combatants[id]!, side };
    }
    patchStats(s, "thorin", {
      attacks: [
        {
          name: "Shortbow",
          range: "ranged",
          rangeFt: { normal: 80, long: 320 },
          toHit: 3,
          damage: [],
        },
        { name: "Longsword", range: "melee", reachFt: 5, toHit: 5, damage: [] },
      ],
    });
    return s;
  };
  // Spec 101: the engine reads melee pairs; seed one for the positive cases.
  const engaged = () => {
    const s = sided();
    s.engine.encounter = {
      round: 1,
      turnIndex: 0,
      order: Object.keys(s.engine.combatants).map((combatantId) => ({
        combatantId,
        total: 10,
        bonus: 0,
      })),
      melee: [["goblin-2", "thorin"]],
    };
    return s;
  };
  const weapon = (w: string) =>
    intent("attack", { targets: [tgt("goblin-2")], params: { weapon: w } });

  it("a ranged attack with a hostile in a melee pair reports the rule", () => {
    expect(cmds(run(weapon("Shortbow"), engaged())).facts).toContainEqual(RULE);
  });

  it("a ranged attack with a same-zone hostile and no pair does not (spec 101)", () => {
    expect(cmds(run(weapon("Shortbow"), sided())).facts).not.toContainEqual(
      RULE,
    );
  });

  it("a melee attack does not", () => {
    expect(cmds(run(weapon("Longsword"), engaged())).facts).not.toContainEqual(
      RULE,
    );
  });

  it("a ranged attack with no hostile in the zone and no pair does not", () => {
    const s = placeAt(sided(), "goblin-2", "b");
    expect(cmds(run(weapon("Shortbow"), s)).facts).not.toContainEqual(RULE);
  });
});

describe("cast", () => {
  const cast = (spell: string, over: Record<string, unknown> = {}) =>
    intent("cast", {
      actor: actors.companion,
      targets: [tgt("goblin-2")],
      params: { spell, ...(over.params as object) },
      ...(over.targets ? { targets: over.targets } : {}),
    });

  it.each([
    ["fire-bolt", null],
    ["sacred-flame", null],
    ["inflict-wounds", 1],
    ["ray-of-sickness", 1],
    ["cure-wounds", 1],
    ["healing-word", 1],
  ])("plans spell.cast for %s", (spell, slot) => {
    const r = cmds(run(cast(spell)));
    expect(r.commands).toHaveLength(1);
    expect(r.commands[0]?.command).toEqual({
      type: "spell.cast",
      casterId: "mira",
      spellId: spell,
      targetId: "goblin-2",
      slotLevel: slot,
      casterLevel: 3,
      houseRules: { outcomeBands: false, naturals: false },
      reason: expect.any(String),
    });
  });

  it("no target means the caster; an explicit slot is honoured", () => {
    const r = cmds(
      run(cast("cure-wounds", { targets: [], params: { slot: 2 } })),
    );
    expect(r.commands[0]?.command).toMatchObject({
      targetId: "mira",
      slotLevel: 2,
    });
  });

  it("refuses SPELL_UNKNOWN, SPELL_NOT_PREPARED and SPELL_UNRESOLVED (engine)", () => {
    const code = (r: PlanResult) => {
      const f = refusal(r);
      expect(f.source).toBe("engine");
      return f.code;
    };
    expect(code(run(cast("not-a-spell")))).toBe("SPELL_UNKNOWN");
    expect(code(run(cast("fireball")))).toBe("SPELL_NOT_PREPARED");
    const s = baseState();
    s.casters.mira = { level: 3, spells: ["fireball"] };
    expect(code(run(cast("fireball"), s))).toBe("SPELL_UNRESOLVED");
    expect(code(run(cast("fire-bolt", { params: { slot: 2 } })))).toBe(
      "SPELL_UNRESOLVED",
    );
    expect(
      code(
        run(
          cast("fire-bolt", {
            targets: [tgt("goblin-2"), tgt("snag")],
          }),
        ),
      ),
    ).toBe("SPELL_UNRESOLVED");
    expect(code(run(cast("fire-bolt", { targets: [zone("b")] })))).toBe(
      "SPELL_UNRESOLVED",
    );
    expect(
      code(
        run(cast("fire-bolt", { targets: [{ kind: "point", x: 1, y: 1 }] })),
      ),
    ).toBe("SPELL_UNRESOLVED");
  });

  it("refuses STAT_UNDEFINED with no spellcasting modifier or no save modifier", () => {
    let s = patchStats(baseState(), "mira", { spellcastingAbility: null });
    expect(refusal(run(cast("fire-bolt"), s)).code).toBe("STAT_UNDEFINED");
    s = withCombatant(baseState(), "goblin-2", { stats: undefined });
    const f = refusal(run(cast("sacred-flame"), s));
    expect([f.source, f.code]).toEqual(["engine", "STAT_UNDEFINED"]);
  });
});

describe("help", () => {
  it("an attack assist targets a creature in the helper's engaged band", () => {
    const r = cmds(
      run(
        intent("help", {
          targets: [tgt("goblin-2")],
          params: { assist: { kind: "attack" } },
        }),
      ),
    );
    expect(r.commands[0]?.command).toEqual({
      type: "help.grant",
      helperId: "thorin",
      assist: { kind: "attack", targetId: "goblin-2" },
      reason: expect.any(String),
    });
    expect(r.facts).toContainEqual({
      kind: "rule",
      rule: "rules-glossary.help-action",
    });
  });

  it("an attack assist refuses OUT_OF_REACH beyond the engaged band", () => {
    const f = refusal(
      run(
        intent("help", {
          targets: [tgt("goblin-2")],
          params: { assist: { kind: "attack" } },
        }),
        near(),
      ),
    );
    expect([f.source, f.code]).toEqual(["planner", "OUT_OF_REACH"]);
  });

  it("a check assist helps an ally", () => {
    const r = cmds(
      run(
        intent("help", {
          targets: [tgt("kestrel")],
          params: { assist: { kind: "check", skill: "athletics" } },
        }),
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      assist: { kind: "ability-check", allyId: "kestrel", skill: "athletics" },
    });
  });

  it("a check assist refuses STAT_UNDEFINED when the helper has no stats", () => {
    const s = withCombatant(baseState(), "thorin", { stats: undefined });
    const f = refusal(
      run(
        intent("help", {
          targets: [tgt("kestrel")],
          params: { assist: { kind: "check", skill: "athletics" } },
        }),
        s,
      ),
    );
    expect(f.code).toBe("STAT_UNDEFINED");
  });
});

describe("grapple and shove", () => {
  it("grapple: the target's save against unarmed-strike, then grappled on failure", () => {
    const r = cmds(run(intent("grapple", { targets: [tgt("goblin-2")] })));
    expect(r.commands).toHaveLength(2);
    expect(r.commands[0]?.command).toMatchObject({
      type: "check.roll",
      combatantId: "goblin-2",
      kind: "saving-throw",
      ability: "dex",
      opposition: { opponentId: "thorin", rule: "unarmed-strike" },
    });
    expect(r.commands[1]).toMatchObject({
      command: {
        type: "condition.apply",
        targetId: "goblin-2",
        condition: "grappled",
      },
      when: { step: 0, outcomes: ["failure", "severe-failure"] },
    });
  });

  it("the target's Strength is chosen on a tie", () => {
    const s = baseState();
    patchStats(s, "goblin-2", {
      abilityMods: { str: 2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
    });
    const r = cmds(run(intent("grapple", { targets: [tgt("goblin-2")] }), s));
    expect(r.commands[0]?.command).toMatchObject({ ability: "str" });
  });

  it("shove prone applies prone on failure", () => {
    const r = cmds(
      run(
        intent("shove", {
          targets: [tgt("goblin-2")],
          params: { effect: "prone" },
        }),
      ),
    );
    expect(r.commands[1]).toMatchObject({
      command: { condition: "prone" },
      when: { outcomes: ["failure", "severe-failure"] },
    });
  });

  it("shove push refuses KIND_UNSERVED naming TASK-0274", () => {
    const f = refusal(
      run(
        intent("shove", {
          targets: [tgt("goblin-2")],
          params: { effect: "push" },
        }),
      ),
    );
    expect(f).toMatchObject({
      source: "planner",
      code: "KIND_UNSERVED",
      details: { param: "effect", owner: "TASK-0274" },
    });
  });

  it("the attacker's missing Strength refuses STAT_UNDEFINED", () => {
    const s = withCombatant(baseState(), "thorin", { stats: undefined });
    const f = refusal(
      run(intent("grapple", { targets: [tgt("goblin-2")] }), s),
    );
    expect(f.code).toBe("STAT_UNDEFINED");
  });
});
