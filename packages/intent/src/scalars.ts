// Contract §1. Engine enums are copied by value (this package depends on zod only);
// test/engine-drift.test.ts fails when a copy drifts from the engine.
import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);
export const IntentIdSchema = IdSchema;
export const BodySchema = z.string().trim().min(1).max(4000);
export const NoteSchema = z.string().min(1).max(500);
export const SlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const LabelSchema = z.string().min(1).max(60);
export const DiceSchema = z.string().min(1).max(200);

export const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export const SkillSchema = z.enum([
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
]);
export const DifficultySchema = z.enum([
  "very-easy",
  "easy",
  "medium",
  "hard",
  "very-hard",
  "nearly-impossible",
]);
export const DamageTypeSchema = z.enum([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);
export const ConditionSchema = z.enum([
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
]);
export const RollModeSchema = z.enum(["normal", "advantage", "disadvantage"]);
export const DcSchema = z.number().int().min(1).max(40);
export const AmountSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("fixed"),
    value: z.number().int().min(0).max(10000),
  }),
  z.strictObject({ kind: z.literal("roll"), expression: DiceSchema }),
]);
