# Contract: SRD record schemas (Zod)

Normative. Lives in `packages/srd/src/schema/*.ts`, exported from `@the-stacks/srd`. Field
meanings are in `../data-model.md`. All object schemas are `.strict()`: an unknown field
fails validation, so a converter bug cannot smuggle extra content in.

```ts
import { z } from "zod";

export const SrdKind = z.enum(["monster", "spell", "class", "equipment", "condition"]);

export const RecordId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const SourceRef = z
  .object({
    document: z.literal("SRD 5.2.1"),
    section: z.string().min(1),
    page: z.number().int().min(1).max(364),
  })
  .strict();

const Base = { id: RecordId, name: z.string().min(1), source: SourceRef };

const Ability = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const Dice = z.string().regex(/^\d+d\d+( [+-] \d+)?$/); // "3d6", "10d10 + 30"
const DamageType = z.enum([
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
]);
const Size = z.enum(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]);

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
    range: z.object({ normal: z.number().int(), long: z.number().int().optional() }).strict().optional(),
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

const AbilityBlock = z.object({ score: z.number().int(), mod: z.number().int(), save: z.number().int() }).strict();

export const Monster = z
  .object({
    ...Base,
    size: z.array(Size).min(1),
    type: z.string().min(1),
    tags: z.array(z.string()),
    alignment: z.string().min(1),
    ac: z.number().int(),
    acNote: z.string().optional(),
    initiative: z.object({ mod: z.number().int(), score: z.number().int() }).strict(),
    hp: z.object({ average: z.number().int().positive(), formula: Dice }).strict(),
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
    abilities: z.object({ str: AbilityBlock, dex: AbilityBlock, con: AbilityBlock, int: AbilityBlock, wis: AbilityBlock, cha: AbilityBlock }).strict(),
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

// ---- spell ----
export const Spell = z
  .object({
    ...Base,
    level: z.number().int().min(0).max(9),
    school: z.enum(["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"]),
    classes: z.array(RecordId).min(1),
    castingTime: z.string().min(1),
    ritual: z.boolean(),
    reactionTrigger: z.string().optional(),
    range: z.string().min(1),
    components: z.object({ v: z.boolean(), s: z.boolean(), m: z.boolean(), material: z.string().optional() }).strict(),
    concentration: z.boolean(),
    duration: z.string().min(1),
    text: z.string().min(1),
    higherLevels: z.string().optional(),
  })
  .strict();

// ---- class ----
const Feature = z.object({ name: z.string().min(1), level: z.number().int().min(1).max(20), text: z.string().min(1) }).strict();

export const CharacterClass = z
  .object({
    ...Base,
    hitDie: z.enum(["d6", "d8", "d10", "d12"]),
    primaryAbility: z.string().min(1),
    savingThrows: z.array(Ability).length(2),
    skillChoices: z.object({ count: z.number().int().positive(), from: z.array(z.string()).min(1) }).strict(),
    weaponProficiencies: z.array(z.string()),
    armorTraining: z.array(z.string()),
    toolProficiencies: z.array(z.string()),
    startingEquipment: z.string(),
    spellcastingAbility: Ability.optional(),
    levels: z
      .array(
        z.object({
          level: z.number().int().min(1).max(20),
          proficiencyBonus: z.number().int().min(2).max(6),
          features: z.array(z.string()),
          columns: z.record(z.string(), z.string()),
        }).strict(),
      )
      .length(20),
    features: z.array(Feature),
    subclass: z.object({ id: RecordId, name: z.string().min(1), text: z.string(), features: z.array(Feature).min(1) }).strict(),
  })
  .strict();

// ---- equipment ----
const Cost = z.object({ amount: z.number().min(0), unit: z.enum(["cp", "sp", "ep", "gp", "pp"]) }).strict();
const Weight = z.number().min(0).nullable();

export const Weapon = z.object({
  ...Base,
  category: z.literal("weapon"),
  weaponCategory: z.enum(["simple", "martial"]),
  rangeType: z.enum(["melee", "ranged"]),
  damage: z.object({ dice: Dice.nullable(), average: z.number().int().optional(), type: DamageType }).strict(),
  properties: z.array(z.string()),
  versatile: Dice.optional(),
  range: z.object({ normal: z.number().int(), long: z.number().int() }).strict().optional(),
  ammunition: z.string().optional(),
  mastery: z.string().min(1),
  weight: Weight,
  cost: Cost,
}).strict();

export const Armor = z.object({
  ...Base,
  category: z.literal("armor"),
  armorCategory: z.enum(["light", "medium", "heavy", "shield"]),
  ac: z.union([
    z.object({ base: z.number().int(), addDex: z.boolean(), dexMax: z.number().int().optional() }).strict(),
    z.object({ bonus: z.number().int() }).strict(),
  ]),
  strength: z.number().int().optional(),
  stealthDisadvantage: z.boolean(),
  don: z.string(),
  doff: z.string(),
  weight: Weight,
  cost: Cost,
}).strict();

export const AdventuringGear = z.object({
  ...Base, category: z.literal("adventuring-gear"), weight: Weight, cost: Cost, text: z.string(),
}).strict();

export const Tool = z.object({
  ...Base,
  category: z.literal("tool"),
  toolCategory: z.enum(["artisan", "other", "gaming-set", "musical-instrument"]),
  ability: Ability,
  utilize: z.string(),
  craft: z.array(z.string()).optional(),
  weight: Weight,
  cost: Cost,
}).strict();

export const MountOrVehicle = z.object({
  ...Base,
  category: z.literal("mount-or-vehicle"),
  vehicleType: z.enum(["mount", "tack", "drawn", "waterborne", "airborne"]),
  cost: Cost,
  weight: Weight.optional(),
  speed: z.string().optional(),
  carryingCapacity: z.string().optional(),
  stats: z.record(z.string(), z.string()).optional(), // printed vehicle stats, verbatim
}).strict();

export const Equipment = z.discriminatedUnion("category", [Weapon, Armor, AdventuringGear, Tool, MountOrVehicle]);

// ---- condition ----
export const Condition = z
  .object({
    ...Base,
    text: z.string().min(1),
    effects: z.array(z.object({ name: z.string().min(1), text: z.string().min(1) }).strict()).min(1),
  })
  .strict();

// ---- per kind ----
export const RecordSchemas = {
  monster: Monster,
  spell: Spell,
  class: CharacterClass,
  equipment: Equipment,
  condition: Condition,
} as const;

export type SrdKind = z.infer<typeof SrdKind>;
export type SrdRecord<K extends SrdKind> = z.infer<(typeof RecordSchemas)[K]>;
```

## Rules the schema alone cannot express (enforced by tests)

1. `id` is unique within its kind.
2. `source.page` lies in the kind's page range (`../data-model.md`).
3. A feature whose `text` contains `Attack Roll:` has `attack`; one containing
   `Saving Throw: DC` has `save`.
4. `Spell.classes` ids each name a shipped class record.
5. Every record's normalized name is in `srd-5.2.1-index.json` for its kind.

## Change policy

Adding an optional field is non-breaking. Renaming or removing a field, or changing an id, is
breaking: it needs a spec amendment, because TASK-0046 prompts and TASK-0064 imported records
depend on these shapes.
