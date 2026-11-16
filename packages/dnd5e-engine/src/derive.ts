import { z } from "zod";
import type {
  Ability,
  Assist,
  AttackEntry,
  Combatant,
  CombatantStats,
  ConditionKey,
  Encounter,
  ExpiryPoint,
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
  if (hit) return { ok: true, value: hit };
  if (want === "unarmed strike") return unarmedStrike(c.stats);
  return { ok: false, missing: `attack "${name}"` };
}

// SRD 5.2.1 Rules Glossary "Unarmed Strike": Str mod + proficiency to hit; 1 + Str mod bludgeoning.
// ponytail: damage floors at 0 (OQ-3); add a rule entry if a feature changes the die (e.g. Monk).
function unarmedStrike(stats: CombatantStats): Derived<AttackEntry> {
  const str = stats.abilityMods.str;
  if (str === undefined) return { ok: false, missing: "str modifier" };
  return {
    ok: true,
    value: {
      name: "Unarmed Strike",
      range: "melee",
      toHit: str + stats.proficiencyBonus,
      damage: [
        {
          amount: { kind: "fixed", value: Math.max(0, 1 + str) },
          damageType: "bludgeoning",
        },
      ],
    },
  };
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

/** SRD 5.2.1 conditions paralyzed, petrified, stunned, unconscious: "Saving Throws Affected". */
const AUTO_FAIL_SAVES = [
  "paralyzed",
  "petrified",
  "stunned",
  "unconscious",
] as const;
/** SRD 5.2.1 conditions paralyzed, unconscious: "Automatic Critical Hits". */
const AUTO_CRIT = ["paralyzed", "unconscious"] as const;

/** Spec 119: the condition that makes this Strength or Dexterity save fail, or null. */
export function autoFailCondition(
  c: Combatant,
  kind: "ability-check" | "saving-throw",
  ability: Ability,
): ConditionKey | null {
  if (kind !== "saving-throw" || (ability !== "str" && ability !== "dex"))
    return null;
  return (
    c.conditions.find((i) =>
      (AUTO_FAIL_SAVES as readonly string[]).includes(i.condition),
    )?.condition ?? null
  );
}

/** Spec 119: the condition that turns a hit within 5 feet into a Critical Hit, or null. */
export function autoCritCondition(c: Combatant): ConditionKey | null {
  return (
    c.conditions.find((i) =>
      (AUTO_CRIT as readonly string[]).includes(i.condition),
    )?.condition ?? null
  );
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

/** Spec 084: SRD rules that derive a check's DC from an opponent's stats. */
export const OppositionRuleSchema = z.enum(["unarmed-strike", "influence"]);
export type OppositionRule = z.infer<typeof OppositionRuleSchema>;

const INFLUENCE_SKILLS: readonly Skill[] = [
  "deception",
  "intimidation",
  "performance",
  "persuasion",
];

/**
 * Which checks a rule covers. unarmed-strike (SRD 5.2.1 p. 190, Grapple and Shove): the target's
 * Strength (Athletics) or Dexterity (Acrobatics) check, or a Strength or Dexterity save.
 * influence (rules-glossary.influence-action): Charisma (Deception, Intimidation, Performance,
 * Persuasion) or Wisdom (Animal Handling).
 */
export function oppositionCovers(
  rule: OppositionRule,
  kind: "ability-check" | "saving-throw",
  ability: Ability,
  skill: Skill | null,
): boolean {
  if (rule === "unarmed-strike") {
    if (kind === "saving-throw") return ability === "str" || ability === "dex";
    if (skill === null) return ability === "str" || ability === "dex";
    return (
      (ability === "str" && skill === "athletics") ||
      (ability === "dex" && skill === "acrobatics")
    );
  }
  if (kind !== "ability-check") return false;
  if (ability === "cha")
    return skill !== null && INFLUENCE_SKILLS.includes(skill);
  return ability === "wis" && skill === "animal-handling";
}

/**
 * unarmed-strike: 8 + Strength modifier + proficiency bonus (Unarmed Strike, SRD 5.2.1 p. 190).
 * influence: the higher of 15 and the opponent's Intelligence score (rules-glossary.influence-action).
 * ponytail: the unarmed-strike DC uses the Strength modifier only; a creature using its stat-block
 * DC is TASK-0224. Add when monsters carry feature DCs.
 */
export function oppositionDc(
  opponent: Combatant,
  rule: OppositionRule,
): Derived<number> {
  const stats = opponent.stats;
  if (!stats) return { ok: false, missing: "stats" };
  if (rule === "unarmed-strike") {
    const str = stats.abilityMods.str;
    return str === undefined
      ? { ok: false, missing: "str modifier" }
      : { ok: true, value: 8 + str + stats.proficiencyBonus };
  }
  const int = stats.abilityScores?.int;
  return int === undefined
    ? { ok: false, missing: "int score" }
    : { ok: true, value: Math.max(15, int) };
}

/** The holder's open ability-check assists for this skill (rules-glossary.help-action). */
export function checkAssists(
  c: Combatant,
  kind: "ability-check" | "saving-throw",
  skill: Skill | null,
): Assist[] {
  if (kind !== "ability-check" || skill === null) return [];
  return (c.assists ?? []).filter(
    (a) => a.kind === "ability-check" && a.skill === skill,
  );
}

/**
 * The target's open attack assists that serve this attacker: any helper but the attacker.
 * ponytail: no factions; "one of your allies" is any attacker but the helper. Add with factions.
 */
export function attackAssists(
  target: Combatant | undefined,
  attackerId: string | null,
): Assist[] {
  return (target?.assists ?? []).filter(
    (a) => a.kind === "attack" && a.helperId !== attackerId,
  );
}

/**
 * The start of the helper's next turn (rules-glossary.help-action: "expires ... before the start of
 * your next turn"). Round R if the helper sits after the active index, else R + 1.
 */
export function helperExpiry(
  enc: Encounter | null,
  helperId: string,
): ExpiryPoint | null {
  if (!enc) return null;
  const idx = enc.order.findIndex((e) => e.combatantId === helperId);
  if (idx < 0) return null;
  return {
    round: idx > enc.turnIndex ? enc.round : enc.round + 1,
    combatantId: helperId,
    boundary: "turn-start",
  };
}
