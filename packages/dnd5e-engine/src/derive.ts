import { z } from "zod";
import type {
  Ability,
  AttackEntry,
  Combatant,
  CombatantStats,
  Skill,
} from "./schema/state.js";
import { SKILL_ABILITY } from "./schema/state.js";

/** SRD 5.2.1 "Typical Difficulty Classes" (p. 6). */
export const DifficultySchema = z.enum([
  "very-easy",
  "easy",
  "medium",
  "hard",
  "very-hard",
  "nearly-impossible",
]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const DIFFICULTY_DC: Record<Difficulty, number> = {
  "very-easy": 5,
  easy: 10,
  medium: 15,
  hard: 20,
  "very-hard": 25,
  "nearly-impossible": 30,
};

export type RollMode = "normal" | "advantage" | "disadvantage";
export type ModeSource = "advantage" | "disadvantage";
export type Derived<T> =
  | { ok: true; value: T }
  | { ok: false; missing: string };

function has(c: Combatant, key: string): boolean {
  return c.conditions.some((i) => i.condition === key);
}

/** SRD condition record `exhaustion`: each level is -2 to every d20 test. */
function exhaustionPenalty(c: Combatant): number {
  const level = c.conditions.find((i) => i.condition === "exhaustion")?.level;
  return 2 * (level ?? 0);
}

/**
 * Check or save modifier from stats totals (playing-the-game.d20-tests.ability-checks,
 * ...saving-throws). A skill total replaces the ability modifier, so it already carries proficiency.
 */
export function checkModifier(
  c: Combatant,
  kind: "ability-check" | "saving-throw",
  ability: Ability,
  skill: Skill | null,
): Derived<number> {
  const stats = c.stats;
  if (!stats) return { ok: false, missing: "stats" };
  const base = stats.abilityMods[ability];
  let mod: number;
  if (kind === "saving-throw") {
    const save = stats.saves[ability] ?? base;
    if (save === undefined)
      return { ok: false, missing: `${ability} modifier` };
    mod = save;
  } else {
    if (base === undefined)
      return { ok: false, missing: `${ability} modifier` };
    const total = skill ? stats.skills[skill] : undefined;
    if (skill && total !== undefined) {
      const paired = stats.abilityMods[SKILL_ABILITY[skill]];
      if (paired === undefined) {
        return { ok: false, missing: `${SKILL_ABILITY[skill]} modifier` };
      }
      // total = paired mod + proficiency; keep the proficiency part, swap in the named ability.
      mod = base + (total - paired);
    } else mod = base;
  }
  return { ok: true, value: mod - exhaustionPenalty(c) };
}

export function findAttack(c: Combatant, name: string): Derived<AttackEntry> {
  if (!c.stats) return { ok: false, missing: "stats" };
  const want = name.trim().toLowerCase();
  const hit = c.stats.attacks.find((a) => a.name.toLowerCase() === want);
  return hit
    ? { ok: true, value: hit }
    : { ok: false, missing: `attack "${name}"` };
}

export function firstMeleeAttack(stats: CombatantStats): AttackEntry | null {
  return stats.attacks.find((a) => a.range !== "ranged") ?? null;
}

/**
 * SRD condition records: poisoned and frightened give disadvantage on ability checks;
 * restrained gives disadvantage on Dexterity saves.
 */
export function checkModeSources(
  c: Combatant,
  kind: "ability-check" | "saving-throw",
  ability: Ability,
): ModeSource[] {
  const out: ModeSource[] = [];
  if (kind === "ability-check") {
    // ponytail: frightened's "line of sight to the source" is not modelled (OQ-6); add with positions.
    if (has(c, "poisoned") || has(c, "frightened")) out.push("disadvantage");
  } else if (ability === "dex" && has(c, "restrained"))
    out.push("disadvantage");
  return out;
}

/**
 * Attacker conditions (blinded, frightened, poisoned, prone, restrained: disadvantage;
 * invisible: advantage) and target conditions (blinded, paralyzed, petrified, restrained,
 * stunned, unconscious: advantage; invisible: disadvantage; prone by range).
 */
export function attackModeSources(
  attacker: Combatant | undefined,
  target: Combatant | undefined,
  entry: AttackEntry,
): ModeSource[] {
  const out: ModeSource[] = [];
  if (attacker) {
    for (const k of [
      "blinded",
      "frightened",
      "poisoned",
      "prone",
      "restrained",
    ]) {
      if (has(attacker, k)) out.push("disadvantage");
    }
    if (has(attacker, "invisible")) out.push("advantage");
  }
  if (target) {
    for (const k of [
      "blinded",
      "paralyzed",
      "petrified",
      "restrained",
      "stunned",
      "unconscious",
    ]) {
      if (has(target, k)) out.push("advantage");
    }
    if (has(target, "invisible")) out.push("disadvantage");
    if (has(target, "prone")) {
      // ponytail: no positions (OQ-6): "within 5 feet" is assumed for melee and melee-or-ranged
      // entries, "farther" for ranged ones. Add distance when the engine tracks positions.
      out.push(entry.range === "ranged" ? "disadvantage" : "advantage");
    }
  }
  return out;
}

/** playing-the-game.d20-tests.advantage-disadvantage.they-dont-stack: any of each cancels. */
export function foldMode(
  base: RollMode,
  sources: readonly ModeSource[],
): RollMode {
  const all = base === "normal" ? [...sources] : [base, ...sources];
  const adv = all.includes("advantage");
  const dis = all.includes("disadvantage");
  if (adv === dis) return "normal";
  return adv ? "advantage" : "disadvantage";
}

export function d20Expression(modifier: number): string {
  if (modifier === 0) return "1d20";
  return modifier > 0 ? `1d20+${modifier}` : `1d20${modifier}`;
}

/** The spellcasting ability modifier, or null when the stats name no ability or lack its modifier. */
export function spellcastingModifier(stats: CombatantStats): number | null {
  const mod = stats.spellcastingAbility
    ? stats.abilityMods[stats.spellcastingAbility]
    : undefined;
  return mod === undefined ? null : mod;
}

/** classes.*.spellcasting: save DC = 8 + spellcasting ability modifier + proficiency bonus. */
export function spellSaveDc(stats: CombatantStats): number | null {
  const mod = spellcastingModifier(stats);
  return mod === null ? null : 8 + mod + stats.proficiencyBonus;
}

/** Spell attack bonus = spellcasting ability modifier + proficiency bonus. */
export function spellAttackBonus(stats: CombatantStats): number | null {
  const mod = spellcastingModifier(stats);
  return mod === null ? null : mod + stats.proficiencyBonus;
}
