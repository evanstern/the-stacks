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
  })
  .superRefine((c, ctx) => {
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
  })
  .superRefine((e, ctx) => {
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
  })
  .superRefine((s, ctx) => {
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
export type Skill = z.infer<typeof SkillSchema>;
export type ExpiryPoint = z.infer<typeof ExpiryPointSchema>;
export type ConditionInstance = z.infer<typeof ConditionInstanceSchema>;
export type DamageType = z.infer<typeof DamageTypeSchema>;
export type DefenseSet = z.infer<typeof DefenseSetSchema>;
export type Combatant = z.infer<typeof CombatantSchema>;
export type Encounter = z.infer<typeof EncounterSchema>;
export type EngineState = z.infer<typeof EngineStateSchema>;
