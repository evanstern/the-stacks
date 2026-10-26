import { z } from "zod";
import { Ability, Base, DamageType, Dice } from "./common.js";

// ---- equipment ----
const Cost = z
  .object({
    amount: z.number().min(0),
    unit: z.enum(["cp", "sp", "ep", "gp", "pp"]),
  })
  .strict();
const Weight = z.number().min(0).nullable();

export const Weapon = z
  .object({
    ...Base,
    category: z.literal("weapon"),
    weaponCategory: z.enum(["simple", "martial"]),
    rangeType: z.enum(["melee", "ranged"]),
    damage: z
      .object({
        dice: Dice.nullable(),
        average: z.number().int().optional(),
        type: DamageType,
      })
      .strict(),
    properties: z.array(z.string()),
    versatile: Dice.optional(),
    range: z
      .object({ normal: z.number().int(), long: z.number().int() })
      .strict()
      .optional(),
    ammunition: z.string().optional(),
    mastery: z.string().min(1),
    weight: Weight,
    cost: Cost,
  })
  .strict();

export const Armor = z
  .object({
    ...Base,
    category: z.literal("armor"),
    armorCategory: z.enum(["light", "medium", "heavy", "shield"]),
    ac: z.union([
      z
        .object({
          base: z.number().int(),
          addDex: z.boolean(),
          dexMax: z.number().int().optional(),
        })
        .strict(),
      z.object({ bonus: z.number().int() }).strict(),
    ]),
    strength: z.number().int().optional(),
    stealthDisadvantage: z.boolean(),
    don: z.string(),
    doff: z.string(),
    weight: Weight,
    cost: Cost,
  })
  .strict();

export const AdventuringGear = z
  .object({
    ...Base,
    category: z.literal("adventuring-gear"),
    weight: Weight,
    cost: Cost,
    text: z.string(),
  })
  .strict();

export const Tool = z
  .object({
    ...Base,
    category: z.literal("tool"),
    toolCategory: z.enum([
      "artisan",
      "other",
      "gaming-set",
      "musical-instrument",
    ]),
    ability: Ability,
    utilize: z.string(),
    craft: z.array(z.string()).optional(),
    weight: Weight,
    cost: Cost,
  })
  .strict();

export const MountOrVehicle = z
  .object({
    ...Base,
    category: z.literal("mount-or-vehicle"),
    vehicleType: z.enum(["mount", "tack", "drawn", "waterborne", "airborne"]),
    cost: Cost,
    weight: Weight.optional(),
    speed: z.string().optional(),
    carryingCapacity: z.string().optional(),
    stats: z.record(z.string(), z.string()).optional(), // printed vehicle stats, verbatim
  })
  .strict();

export const Equipment = z.discriminatedUnion("category", [
  Weapon,
  Armor,
  AdventuringGear,
  Tool,
  MountOrVehicle,
]);
