import { describe, expect, it } from "vitest";
import {
  type AttackEntry,
  attackModeSources,
  type CombatantStats,
  checkModeSources,
  checkModifier,
  DIFFICULTY_DC,
  d20Expression,
  foldMode,
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
