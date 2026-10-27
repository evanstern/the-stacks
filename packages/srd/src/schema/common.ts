import { z } from "zod";

export const SrdKind = z.enum([
  "monster",
  "spell",
  "class",
  "equipment",
  "condition",
  "rule",
]);

export const RecordId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const SourceRef = z
  .object({
    document: z.literal("SRD 5.2.1"),
    section: z.string().min(1),
    page: z.number().int().min(1).max(364),
  })
  .strict();

export const Base = {
  id: RecordId,
  name: z.string().min(1),
  source: SourceRef,
};

export const Ability = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export const Dice = z.string().regex(/^\d+d\d+( [+-] \d+)?$/); // "3d6", "10d10 + 30"
export const DamageType = z.enum([
  "Acid",
  "Bludgeoning",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Thunder",
]);
export const Size = z.enum([
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan",
]);

export type SrdKind = z.infer<typeof SrdKind>;
