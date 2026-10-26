import { z } from "zod";
import { Ability, Base, RecordId } from "./common.js";

// ---- class ----
const Feature = z
  .object({
    name: z.string().min(1),
    level: z.number().int().min(1).max(20),
    text: z.string().min(1),
  })
  .strict();

export const CharacterClass = z
  .object({
    ...Base,
    hitDie: z.enum(["d6", "d8", "d10", "d12"]),
    primaryAbility: z.string().min(1),
    savingThrows: z.array(Ability).length(2),
    skillChoices: z
      .object({
        count: z.number().int().positive(),
        from: z.array(z.string()).min(1),
      })
      .strict(),
    weaponProficiencies: z.array(z.string()),
    armorTraining: z.array(z.string()),
    toolProficiencies: z.array(z.string()),
    startingEquipment: z.string(),
    spellcastingAbility: Ability.optional(),
    levels: z
      .array(
        z
          .object({
            level: z.number().int().min(1).max(20),
            proficiencyBonus: z.number().int().min(2).max(6),
            features: z.array(z.string()),
            columns: z.record(z.string(), z.string()),
          })
          .strict(),
      )
      .length(20),
    features: z.array(Feature),
    subclass: z
      .object({
        id: RecordId,
        name: z.string().min(1),
        text: z.string(),
        features: z.array(Feature).min(1),
      })
      .strict(),
  })
  .strict();
