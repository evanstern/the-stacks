import { PlacementSchema, SpaceSchema } from "@the-stacks/space";
import { z } from "zod";

export const ENGINE_SCHEMA_VERSION = 1;

export const CombatantIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);

export const LifeStateSchema = z.enum([
  "conscious",
  "unconscious",
  "stable",
  "dead",
]);

export const ConditionKeySchema = z.enum([
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

/**
 * The 18 SRD 5.2.1 skills as lowercase kebab-case keys. The only literal
 * skill list: the server derives its gates and prompts from this enum.
 */
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

export const ExpiryPointSchema = z.object({
  round: z.number().int().min(1),
  combatantId: CombatantIdSchema,
  boundary: z.enum(["turn-start", "turn-end"]),
});

export const ConditionInstanceSchema = z.object({
  instanceId: z.string().min(1),
  condition: ConditionKeySchema,
  level: z.number().int().min(1).max(6).nullable(),
  source: z.string().min(1).max(200),
  expiresAt: ExpiryPointSchema.nullable(),
});

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

function uniqueList(label: string) {
  return (list: string[], ctx: z.RefinementCtx) => {
    if (new Set(list).size !== list.length) {
      ctx.addIssue({
        code: "custom",
        message: `${label} must hold unique damage types`,
      });
    }
  };
}

export const DefenseSetSchema = z.object({
  resistances: z.array(DamageTypeSchema).superRefine(uniqueList("resistances")),
  vulnerabilities: z
    .array(DamageTypeSchema)
    .superRefine(uniqueList("vulnerabilities")),
  immunities: z.array(DamageTypeSchema).superRefine(uniqueList("immunities")),
});

export const HitDieSchema = z.union([
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
]);

export const HitDicePoolSchema = z
  .object({
    die: HitDieSchema,
    total: z.number().int().min(0),
    remaining: z.number().int().min(0),
  })
  .superRefine((pool, ctx) => {
    if (pool.remaining > pool.total) {
      ctx.addIssue({
        code: "custom",
        message: "remaining exceeds total",
        path: ["remaining"],
      });
    }
  });

export const SlotSchema = z
  .object({
    max: z.number().int().min(0),
    expended: z.number().int().min(0),
  })
  .superRefine((slot, ctx) => {
    if (slot.expended > slot.max) {
      ctx.addIssue({
        code: "custom",
        message: "expended exceeds max",
        path: ["expended"],
      });
    }
  });

export const SlotLevelKeySchema = z.enum([
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

export const SpellSlotsSchema = z.object({
  // A missing key means the combatant has no slots of that level.
  standard: z.partialRecord(SlotLevelKeySchema, SlotSchema),
  pact: z
    .object({ level: z.number().int().min(1).max(5), slot: SlotSchema })
    .nullable(),
});

export const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

/** A fixed or rolled amount (damage components, healing). Moved here from commands.ts. */
export const AmountSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed"),
    value: z.number().int().min(0).max(10000),
  }),
  z.object({
    kind: z.literal("roll"),
    expression: z.string().min(1).max(200),
  }),
]);

/**
 * The ability each skill is paired with by default.
 * SRD 5.2.1 playing-the-game.proficiency.skill-proficiencies (Skills table).
 */
export const SKILL_ABILITY: Record<
  z.infer<typeof SkillSchema>,
  z.infer<typeof AbilitySchema>
> = {
  acrobatics: "dex",
  "animal-handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight-of-hand": "dex",
  stealth: "dex",
  survival: "wis",
};

export const AttackEntrySchema = z.object({
  name: z.string().min(1).max(60),
  range: z.enum(["melee", "ranged", "melee-or-ranged"]),
  // Spec 094: reach and range in feet; the band checks read these.
  reachFt: z.number().int().min(5).max(30).optional(),
  rangeFt: z
    .object({
      normal: z.number().int().min(5).max(1000),
      long: z.number().int().min(5).max(1000),
    })
    .refine((r) => r.normal <= r.long, "normal must not exceed long")
    .optional(),
  toHit: z.number().int().min(-5).max(30),
  damage: z
    .array(z.object({ amount: AmountSchema, damageType: DamageTypeSchema }))
    .max(4),
});

/** Spec 082: the numbers the engine derives rolls from. Totals, not proficiency flags. */
export const CombatantStatsSchema = z.object({
  abilityMods: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(10)),
  proficiencyBonus: z.number().int().min(0).max(9),
  saves: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(20)),
  skills: z.partialRecord(SkillSchema, z.number().int().min(-5).max(20)),
  attacks: z.array(AttackEntrySchema).max(12),
  spellcastingAbility: AbilitySchema.nullable(),
  // Spec 084: ability scores (not modifiers); needed by the `influence` opposition DC.
  abilityScores: z
    .partialRecord(AbilitySchema, z.number().int().min(1).max(30))
    .optional(),
});

/**
 * Spec 084: an open Help action, held on the combatant who benefits.
 * SRD 5.2.1 rules-glossary.help-action.
 */
export const AssistSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ability-check"),
    helperId: CombatantIdSchema,
    skill: SkillSchema,
    expiresAt: ExpiryPointSchema.nullable(),
  }),
  z.object({
    kind: z.literal("attack"),
    helperId: CombatantIdSchema,
    expiresAt: ExpiryPointSchema.nullable(),
  }),
]);

export const SideSchema = z.enum(["party", "hostile", "neutral"]);
export type Side = z.infer<typeof SideSchema>;

export const CombatantSchema = z
  .object({
    id: CombatantIdSchema,
    name: z.string().min(1).max(100),
    hp: z.object({
      current: z.number().int().min(0),
      max: z.number().int().min(1),
      temp: z.number().int().min(0),
    }),
    zeroHpRule: z.enum(["death-saves", "dies"]),
    lifeState: LifeStateSchema,
    deathSaves: z.object({
      successes: z.number().int().min(0).max(3),
      failures: z.number().int().min(0).max(3),
    }),
    conditions: z.array(ConditionInstanceSchema),
    conditionSeq: z.number().int().min(0),
    hitDice: z.array(HitDicePoolSchema),
    spellSlots: SpellSlotsSchema,
    initiativeBonus: z.number().int().min(-10).max(30),
    conModifier: z.number().int().min(-5).max(10),
    ac: z.number().int().min(1).max(40).nullable(),
    defenses: DefenseSetSchema,
    stats: CombatantStatsSchema.optional(),
    assists: z.array(AssistSchema).max(8).optional(),
    // Spec 094: where the combatant stands, and its walking Speed in feet.
    placement: PlacementSchema.optional(),
    speed: z.number().int().min(0).max(200).optional(),
    // Spec 099: allegiance in a fight. Missing opposes no one.
    side: SideSchema.optional(),
  })
  .superRefine((c, ctx) => {
    const helpers = (c.assists ?? []).map((a) => a.helperId);
    if (new Set(helpers).size !== helpers.length) {
      ctx.addIssue({
        code: "custom",
        message: "assist helper ids must be unique",
        path: ["assists"],
      });
    }
    if (c.hp.current > c.hp.max) {
      ctx.addIssue({
        code: "custom",
        message: "hp.current exceeds hp.max",
        path: ["hp", "current"],
      });
    }
    const dice = c.hitDice.map((p) => p.die);
    if (new Set(dice).size !== dice.length) {
      ctx.addIssue({
        code: "custom",
        message: "hit-die sizes must be unique",
        path: ["hitDice"],
      });
    }
    if (c.lifeState === "conscious" && c.hp.current === 0) {
      ctx.addIssue({
        code: "custom",
        message: "conscious requires hp.current > 0",
        path: ["lifeState"],
      });
    }
    if (
      (c.lifeState === "unconscious" || c.lifeState === "stable") &&
      c.hp.current !== 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${c.lifeState} requires hp.current === 0`,
        path: ["lifeState"],
      });
    }
  });

export const InitiativeEntrySchema = z.object({
  combatantId: CombatantIdSchema,
  total: z.number().int(),
  bonus: z.number().int(),
});

export const EncounterSchema = z
  .object({
    round: z.number().int().min(1),
    turnIndex: z.number().int().min(0),
    order: z.array(InitiativeEntrySchema).min(1),
    // Combatants whose Reaction is spent until the start of their next turn (SRD 5.2.1 p. 10).
    reactionsSpent: z.array(CombatantIdSchema).optional(),
    // Spec 094: the active combatant's movement this turn. A record whose round or
    // combatantId differs from the active turn reads as zero movement used.
    movement: z
      .object({
        combatantId: CombatantIdSchema,
        round: z.number().int().min(1),
        usedFt: z.number().int().min(0),
        dashes: z.number().int().min(0),
        disengaged: z.boolean(),
      })
      .optional(),
    // Spec 101: hostile pairs engaged in melee (the operator's "engaged"). Sorted ids, unique.
    melee: z.array(z.tuple([CombatantIdSchema, CombatantIdSchema])).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.melee?.some(([a, b]) => a === b)) {
      ctx.addIssue({
        code: "custom",
        message: "a melee pair needs two distinct ids",
        path: ["melee"],
      });
    }
    if (e.turnIndex >= e.order.length) {
      ctx.addIssue({
        code: "custom",
        message: "turnIndex is not below order.length",
        path: ["turnIndex"],
      });
    }
  });

export const EngineStateSchema = z
  .object({
    v: z.literal(ENGINE_SCHEMA_VERSION),
    combatants: z.record(CombatantIdSchema, CombatantSchema),
    encounter: EncounterSchema.nullable(),
    space: SpaceSchema.optional(),
  })
  .superRefine((s, ctx) => {
    const zones = new Set(s.space?.zones.map((z) => z.id));
    for (const [key, c] of Object.entries(s.combatants)) {
      if (c.placement && !zones.has(c.placement.zoneId)) {
        ctx.addIssue({
          code: "custom",
          message: s.space
            ? `"${key}" is placed in unknown zone "${c.placement.zoneId}"`
            : `"${key}" is placed but the state has no space`,
          path: ["combatants", key, "placement"],
        });
      }
    }
    for (const [key, c] of Object.entries(s.combatants)) {
      if (key !== c.id) {
        ctx.addIssue({
          code: "custom",
          message: `record key "${key}" differs from combatant id "${c.id}"`,
          path: ["combatants", key],
        });
      }
    }
    if (s.encounter) {
      for (const entry of s.encounter.order) {
        if (!s.combatants[entry.combatantId]) {
          ctx.addIssue({
            code: "custom",
            message: `encounter names missing combatant "${entry.combatantId}"`,
            path: ["encounter", "order"],
          });
        }
      }
    }
  });

export type CombatantId = z.infer<typeof CombatantIdSchema>;
export type LifeState = z.infer<typeof LifeStateSchema>;
export type ConditionKey = z.infer<typeof ConditionKeySchema>;
export type Ability = z.infer<typeof AbilitySchema>;
export type Amount = z.infer<typeof AmountSchema>;
export type AttackEntry = z.infer<typeof AttackEntrySchema>;
export type CombatantStats = z.infer<typeof CombatantStatsSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type ExpiryPoint = z.infer<typeof ExpiryPointSchema>;
export type Assist = z.infer<typeof AssistSchema>;
export type ConditionInstance = z.infer<typeof ConditionInstanceSchema>;
export type DamageType = z.infer<typeof DamageTypeSchema>;
export type DefenseSet = z.infer<typeof DefenseSetSchema>;
export type Combatant = z.infer<typeof CombatantSchema>;
export type Encounter = z.infer<typeof EncounterSchema>;
export type EngineState = z.infer<typeof EngineStateSchema>;
