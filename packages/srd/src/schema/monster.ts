import { z } from "zod";
import { Ability, Base, DamageType, Dice, Size } from "./common.js";

// ---- monster ----
export const DamagePart = z
  .object({
    average: z.number().int().min(0),
    dice: Dice.nullable(),
    type: DamageType,
    condition: z.string().min(1).optional(),
  })
  .strict();

export const MonsterAttack = z
  .object({
    type: z.enum(["melee", "ranged", "melee-or-ranged"]),
    bonus: z.number().int(),
    reach: z.number().int().positive().optional(),
    range: z
      .object({ normal: z.number().int(), long: z.number().int().optional() })
      .strict()
      .optional(),
    hit: z.array(DamagePart),
    hitText: z.string().optional(), // non-damage rider, verbatim
  })
  .strict();

export const MonsterSave = z
  .object({
    ability: Ability,
    dc: z.number().int(),
    onFail: z.string().optional(),
    onSuccess: z.string().optional(),
  })
  .strict();

export const MonsterFeature = z
  .object({
    name: z.string().min(1),
    text: z.string().min(1),
    usage: z.string().optional(),
    attack: MonsterAttack.optional(),
    save: MonsterSave.optional(),
  })
  .strict();

const AbilityBlock = z
  .object({
    score: z.number().int(),
    mod: z.number().int(),
    save: z.number().int(),
  })
  .strict();

export const Monster = z
  .object({
    ...Base,
    size: z.array(Size).min(1),
    type: z.string().min(1),
    tags: z.array(z.string()),
    alignment: z.string().min(1),
    ac: z.number().int(),
    acNote: z.string().optional(),
    initiative: z
      .object({ mod: z.number().int(), score: z.number().int() })
      .strict(),
    hp: z
      .object({ average: z.number().int().positive(), formula: Dice })
      .strict(),
    speed: z
      .object({
        walk: z.number().int().min(0),
        burrow: z.number().int().optional(),
        climb: z.number().int().optional(),
        fly: z.number().int().optional(),
        swim: z.number().int().optional(),
        hover: z.boolean().optional(),
      })
      .strict(),
    abilities: z
      .object({
        str: AbilityBlock,
        dex: AbilityBlock,
        con: AbilityBlock,
        int: AbilityBlock,
        wis: AbilityBlock,
        cha: AbilityBlock,
      })
      .strict(),
    skills: z.record(z.string(), z.number().int()),
    damageVulnerabilities: z.array(z.string()),
    damageResistances: z.array(z.string()),
    damageImmunities: z.array(z.string()),
    conditionImmunities: z.array(z.string()),
    gear: z.array(z.string()),
    senses: z
      .object({
        blindsight: z.number().int().optional(),
        darkvision: z.number().int().optional(),
        tremorsense: z.number().int().optional(),
        truesight: z.number().int().optional(),
        passivePerception: z.number().int(),
      })
      .strict(),
    languages: z.string(),
    cr: z
      .object({
        rating: z.string().regex(/^(0|1\/8|1\/4|1\/2|[1-9]|[12][0-9]|30)$/),
        xp: z.number().int().min(0),
        xpInLair: z.number().int().optional(),
      })
      .strict(),
    pb: z.number().int().min(2).max(9),
    traits: z.array(MonsterFeature),
    actions: z.array(MonsterFeature),
    bonusActions: z.array(MonsterFeature),
    reactions: z.array(MonsterFeature),
    legendaryActions: z
      .object({
        uses: z.number().int().positive(),
        usesInLair: z.number().int().positive().optional(),
        text: z.string(),
        actions: z.array(MonsterFeature),
      })
      .strict()
      .optional(),
  })
  .strict();
