import { describe, expect, it } from "vitest";
import {
  type AttackEntry,
  attackAssists,
  attackModeSources,
  type CombatantStats,
  checkAssists,
  checkModeSources,
  checkModifier,
  DIFFICULTY_DC,
  d20Expression,
  foldMode,
  helperExpiry,
  oppositionCovers,
  oppositionDc,
  spellAttackBonus,
  spellSaveDc,
} from "../src/index.js";
import { makeCombatant } from "./helpers.js";

const stats = (over: Partial<CombatantStats> = {}): CombatantStats => ({
  abilityMods: { str: 3, dex: 2, wis: 3, cha: -1 },
  proficiencyBonus: 2,
  saves: { wis: 5 },
  skills: { athletics: 5, stealth: 4 },
  attacks: [],
  spellcastingAbility: null,
  ...over,
});
const cond = (condition: string, level: number | null = null) => ({
  instanceId: `c-${condition}`,
  condition: condition as never,
  level,
  source: "test",
  expiresAt: null,
});
const melee: AttackEntry = {
  name: "Sword",
  range: "melee",
  toHit: 5,
  damage: [],
};
const bow: AttackEntry = { name: "Bow", range: "ranged", toHit: 5, damage: [] };

describe("checkModifier", () => {
  const c = makeCombatant({ stats: stats() });
  it("adds proficiency through the skill total", () => {
    expect(checkModifier(c, "ability-check", "str", "athletics")).toEqual({
      ok: true,
      value: 5,
    });
    expect(checkModifier(c, "ability-check", "wis", null)).toEqual({
      ok: true,
      value: 3,
    });
  });
  it("pairs a skill with another ability", () => {
    // Stealth total 4 = dex 2 + PB 2; with str 3 -> 3 + 2 = 5
    expect(checkModifier(c, "ability-check", "str", "stealth")).toEqual({
      ok: true,
      value: 5,
    });
  });
  it("uses the save total, else the ability modifier", () => {
    expect(checkModifier(c, "saving-throw", "wis", null)).toEqual({
      ok: true,
      value: 5,
    });
    expect(checkModifier(c, "saving-throw", "dex", null)).toEqual({
      ok: true,
      value: 2,
    });
  });
  it("subtracts 2 per exhaustion level", () => {
    const t = makeCombatant({
      stats: stats(),
      conditions: [cond("exhaustion", 2)],
    });
    expect(checkModifier(t, "ability-check", "wis", null)).toEqual({
      ok: true,
      value: -1,
    });
  });
  it("reports missing stats or modifier", () => {
    expect(
      checkModifier(makeCombatant(), "ability-check", "wis", null).ok,
    ).toBe(false);
    expect(checkModifier(c, "ability-check", "int", null).ok).toBe(false);
  });
});

describe("tiers and expressions", () => {
  it("maps each tier to its DC", () => {
    expect(Object.values(DIFFICULTY_DC)).toEqual([5, 10, 15, 20, 25, 30]);
  });
  it("formats d20 expressions", () => {
    expect(d20Expression(0)).toBe("1d20");
    expect(d20Expression(5)).toBe("1d20+5");
    expect(d20Expression(-1)).toBe("1d20-1");
  });
});

describe("modes", () => {
  it("applies each check rule", () => {
    const p = makeCombatant({ conditions: [cond("poisoned")] });
    const f = makeCombatant({ conditions: [cond("frightened")] });
    const r = makeCombatant({ conditions: [cond("restrained")] });
    expect(checkModeSources(p, "ability-check", "str")).toEqual([
      "disadvantage",
    ]);
    expect(checkModeSources(f, "ability-check", "str")).toEqual([
      "disadvantage",
    ]);
    expect(checkModeSources(p, "saving-throw", "str")).toEqual([]);
    expect(checkModeSources(r, "saving-throw", "dex")).toEqual([
      "disadvantage",
    ]);
    expect(checkModeSources(r, "saving-throw", "str")).toEqual([]);
  });
  it("applies attacker and target rules", () => {
    const has = (c: string) => makeCombatant({ conditions: [cond(c)] });
    for (const c of [
      "blinded",
      "frightened",
      "poisoned",
      "prone",
      "restrained",
    ]) {
      expect(attackModeSources(has(c), undefined, melee)).toEqual([
        "disadvantage",
      ]);
    }
    expect(attackModeSources(has("invisible"), undefined, melee)).toEqual([
      "advantage",
    ]);
    for (const c of [
      "blinded",
      "paralyzed",
      "petrified",
      "restrained",
      "stunned",
      "unconscious",
    ]) {
      expect(attackModeSources(undefined, has(c), melee)).toEqual([
        "advantage",
      ]);
    }
    expect(attackModeSources(undefined, has("invisible"), melee)).toEqual([
      "disadvantage",
    ]);
  });
  it("splits prone targets by range", () => {
    const prone = makeCombatant({ conditions: [cond("prone")] });
    expect(attackModeSources(undefined, prone, melee)).toEqual(["advantage"]);
    expect(attackModeSources(undefined, prone, bow)).toEqual(["disadvantage"]);
  });
  it("cancels advantage against disadvantage", () => {
    expect(foldMode("normal", ["advantage", "disadvantage"])).toBe("normal");
    expect(foldMode("advantage", ["disadvantage"])).toBe("normal");
    expect(foldMode("normal", ["advantage", "advantage"])).toBe("advantage");
    expect(foldMode("disadvantage", [])).toBe("disadvantage");
  });
});

describe("spell numbers", () => {
  it("derives DC and attack for a Wis +3, PB +2 caster", () => {
    const s = stats({ spellcastingAbility: "wis" });
    expect(spellSaveDc(s)).toBe(13);
    expect(spellAttackBonus(s)).toBe(5);
  });
  it("returns null with no ability", () => {
    expect(spellSaveDc(stats())).toBeNull();
    expect(spellAttackBonus(stats())).toBeNull();
  });
});

describe("oppositionDc (spec 084)", () => {
  const snag = makeCombatant({
    stats: stats({ abilityMods: { str: -1 }, abilityScores: { int: 10 } }),
  });
  const tamsin = makeCombatant({ stats: stats({ abilityMods: { str: 3 } }) });
  it("unarmed-strike is 8 + Str + PB", () => {
    expect(oppositionDc(snag, "unarmed-strike")).toEqual({
      ok: true,
      value: 9,
    });
    expect(oppositionDc(tamsin, "unarmed-strike")).toEqual({
      ok: true,
      value: 13,
    });
  });
  it("influence is the higher of 15 and Intelligence", () => {
    expect(oppositionDc(snag, "influence")).toEqual({ ok: true, value: 15 });
    const smart = makeCombatant({
      stats: stats({ abilityScores: { int: 18 } }),
    });
    expect(oppositionDc(smart, "influence")).toEqual({ ok: true, value: 18 });
  });
  it("reports the missing stat", () => {
    expect(oppositionDc(makeCombatant(), "unarmed-strike")).toEqual({
      ok: false,
      missing: "stats",
    });
    expect(
      oppositionDc(
        makeCombatant({ stats: stats({ abilityMods: {} }) }),
        "unarmed-strike",
      ),
    ).toMatchObject({ ok: false });
    expect(oppositionDc(tamsin, "influence")).toMatchObject({ ok: false });
  });
});

describe("oppositionCovers (spec 084)", () => {
  it("covers the SRD checks only", () => {
    expect(
      oppositionCovers("unarmed-strike", "ability-check", "str", "athletics"),
    ).toBe(true);
    expect(
      oppositionCovers("unarmed-strike", "ability-check", "dex", "acrobatics"),
    ).toBe(true);
    expect(
      oppositionCovers("unarmed-strike", "saving-throw", "dex", null),
    ).toBe(true);
    expect(
      oppositionCovers("unarmed-strike", "saving-throw", "wis", null),
    ).toBe(false);
    expect(
      oppositionCovers("unarmed-strike", "ability-check", "str", "stealth"),
    ).toBe(false);
    expect(
      oppositionCovers("influence", "ability-check", "cha", "persuasion"),
    ).toBe(true);
    expect(
      oppositionCovers("influence", "ability-check", "wis", "animal-handling"),
    ).toBe(true);
    expect(oppositionCovers("influence", "ability-check", "cha", null)).toBe(
      false,
    );
    expect(
      oppositionCovers("influence", "ability-check", "str", "athletics"),
    ).toBe(false);
    expect(oppositionCovers("influence", "saving-throw", "cha", null)).toBe(
      false,
    );
  });
});

describe("assists (spec 084)", () => {
  const a = { expiresAt: null };
  const holder = makeCombatant({
    assists: [
      { kind: "ability-check", helperId: "h1", skill: "athletics", ...a },
      { kind: "attack", helperId: "h2", ...a },
    ],
  });
  it("checkAssists matches the skill on ability checks only", () => {
    expect(checkAssists(holder, "ability-check", "athletics")).toHaveLength(1);
    expect(checkAssists(holder, "ability-check", "stealth")).toHaveLength(0);
    expect(checkAssists(holder, "ability-check", null)).toHaveLength(0);
    expect(checkAssists(holder, "saving-throw", "athletics")).toHaveLength(0);
  });
  it("attackAssists excludes the helper", () => {
    expect(attackAssists(holder, "pc-x")).toHaveLength(1);
    expect(attackAssists(holder, "h2")).toHaveLength(0);
    expect(attackAssists(undefined, "pc-x")).toHaveLength(0);
  });
  it("helperExpiry is this round after the active index, else next", () => {
    const order = ["a", "b", "c"].map((combatantId) => ({
      combatantId,
      total: 10,
      bonus: 0,
    }));
    const enc = (turnIndex: number) => ({ round: 2, turnIndex, order });
    expect(helperExpiry(enc(0), "b")).toEqual({
      round: 2,
      combatantId: "b",
      boundary: "turn-start",
    });
    expect(helperExpiry(enc(1), "b")?.round).toBe(3);
    expect(helperExpiry(enc(2), "b")?.round).toBe(3);
    expect(helperExpiry(null, "b")).toBeNull();
    expect(helperExpiry(enc(0), "zz")).toBeNull();
  });
});
