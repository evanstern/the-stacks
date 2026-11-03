import { z } from "zod";
import {
  CombatantIdSchema,
  ConditionKeySchema,
  DamageTypeSchema,
  DefenseSetSchema,
  ExpiryPointSchema,
  HitDieSchema,
  SkillSchema,
} from "./state.js";

const Reason = z.string().min(1).max(500);
const Id = CombatantIdSchema;
const RollMode = z
  .enum(["normal", "advantage", "disadvantage"])
  .default("normal");
const Amount = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed"),
    value: z.number().int().min(0).max(10000),
  }),
  z.object({
    kind: z.literal("roll"),
    expression: z.string().min(1).max(200),
  }),
]);
const SlotLevel = z.number().int().min(1).max(9);
const Ability = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
// exhaustion moves only through exhaustion.adjust; passing it is a parse failure.
const NonExhaustionCondition = ConditionKeySchema.exclude(["exhaustion"]);

const CombatantInit = z.object({
  id: Id,
  name: z.string().min(1).max(100),
  hp: z
    .object({
      max: z.number().int().min(1).max(10000),
      current: z.number().int().min(0).optional(),
      temp: z.number().int().min(0).optional(),
    })
    .superRefine((hp, ctx) => {
      if (hp.current !== undefined && hp.current > hp.max) {
        ctx.addIssue({
          code: "custom",
          message: "current exceeds max",
          path: ["current"],
        });
      }
    }),
  zeroHpRule: z.enum(["death-saves", "dies"]),
  initiativeBonus: z.number().int().min(-10).max(30).default(0),
  conModifier: z.number().int().min(-5).max(10).default(0),
  ac: z.number().int().min(1).max(40).nullable().default(null),
  defenses: DefenseSetSchema.default({
    resistances: [],
    vulnerabilities: [],
    immunities: [],
  }),
  hitDice: z
    .array(
      z.object({
        die: HitDieSchema,
        total: z.number().int().min(0).max(40),
        remaining: z.number().int().min(0).optional(),
      }),
    )
    .default([]),
  spellSlots: z
    .object({
      standard: z
        .partialRecord(
          z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
          z.number().int().min(0).max(10),
        )
        .default({}),
      pact: z
        .object({
          level: z.number().int().min(1).max(5),
          count: z.number().int().min(1).max(4),
        })
        .nullable()
        .default(null),
    })
    .default({ standard: {}, pact: null }),
});

export const EngineCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("roll"),
    expression: z.string().min(1).max(200),
    mode: RollMode,
    reason: Reason,
  }),
  z.object({
    type: z.literal("attack.roll"),
    attackerId: Id.nullable(),
    targetId: Id,
    expression: z.string().min(1).max(200),
    mode: RollMode,
    targetAc: z.number().int().min(1).max(40).nullable().default(null),
    reaction: z.boolean().optional(),
    reason: Reason,
  }),
  z.object({
    type: z.literal("check.roll"),
    combatantId: Id.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]),
    ability: Ability,
    skill: SkillSchema.nullable().default(null),
    expression: z.string().min(1).max(200),
    mode: RollMode,
    dc: z.number().int().min(1).max(40),
    autoFail: z.object({ reason: Reason }).nullable().default(null),
    reason: Reason,
  }),
  z.object({
    type: z.literal("combatant.add"),
    combatant: CombatantInit,
    reason: Reason,
  }),
  z.object({
    type: z.literal("combatant.remove"),
    combatantId: Id,
    reason: Reason,
  }),
  z.object({
    type: z.literal("damage.apply"),
    targetId: Id,
    components: z
      .array(z.object({ amount: Amount, damageType: DamageTypeSchema }))
      .min(1)
      .max(10),
    critical: z.boolean().default(false),
    defenses: DefenseSetSchema.nullable().default(null),
    reason: Reason,
  }),
  z.object({
    type: z.literal("healing.apply"),
    targetId: Id,
    amount: Amount,
    reason: Reason,
  }),
  z.object({
    type: z.literal("temp-hp.grant"),
    targetId: Id,
    amount: Amount,
    reason: Reason,
  }),
  z.object({
    type: z.literal("condition.apply"),
    targetId: Id,
    condition: NonExhaustionCondition,
    source: z.string().min(1).max(200),
    expiresAt: ExpiryPointSchema.nullable().default(null),
    reason: Reason,
  }),
  z.object({
    type: z.literal("condition.remove"),
    targetId: Id,
    condition: NonExhaustionCondition,
    reason: Reason,
  }),
  z.object({
    type: z.literal("exhaustion.adjust"),
    targetId: Id,
    delta: z
      .number()
      .int()
      .min(-6)
      .max(6)
      .refine((d) => d !== 0, "delta must not be 0"),
    reason: Reason,
  }),
  z.object({
    type: z.literal("initiative.roll"),
    participants: z
      .array(z.object({ combatantId: Id, mode: RollMode }))
      .min(1)
      .max(50),
    reason: Reason,
  }),
  z.object({
    type: z.literal("initiative.join"),
    combatantId: Id,
    mode: RollMode,
    reason: Reason,
  }),
  z.object({
    type: z.literal("initiative.leave"),
    combatantId: Id,
    reason: Reason,
  }),
  z.object({ type: z.literal("turn.advance"), reason: Reason }),
  z.object({ type: z.literal("encounter.end"), reason: Reason }),
  z.object({
    type: z.literal("death-save.roll"),
    targetId: Id,
    mode: RollMode,
    reason: Reason,
  }),
  z.object({
    type: z.literal("stabilize"),
    targetId: Id,
    reason: Reason,
  }),
  z.object({
    type: z.literal("rest.short"),
    participants: z
      .array(
        z.object({
          combatantId: Id,
          spend: z
            .array(
              z.object({
                die: HitDieSchema,
                count: z.number().int().min(0).max(40),
              }),
            )
            .default([]),
        }),
      )
      .min(1)
      .max(20),
    reason: Reason,
  }),
  z.object({
    type: z.literal("rest.long"),
    participants: z.array(Id).min(1).max(20),
    reason: Reason,
  }),
  z.object({
    type: z.literal("spell-slot.expend"),
    targetId: Id,
    pool: z.enum(["standard", "pact"]),
    level: SlotLevel,
    reason: Reason,
  }),
  z.object({
    type: z.literal("spell-slot.restore"),
    targetId: Id,
    pool: z.enum(["standard", "pact"]),
    level: SlotLevel,
    count: z.number().int().min(1).max(9).default(1),
    reason: Reason,
  }),
]);

export type EngineCommand = z.infer<typeof EngineCommandSchema>;
export type CommandOf<T extends EngineCommand["type"]> = Extract<
  EngineCommand,
  { type: T }
>;
