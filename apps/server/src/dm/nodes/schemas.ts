import {
  DamageTypeSchema,
  DefenseSetSchema,
  EngineCommandSchema,
} from "@the-stacks/dnd5e-engine";
import {
  CombatantIdSchema,
  ReasonSchema,
  RefIdSchema,
} from "@the-stacks/session-model";
import { SrdKind } from "@the-stacks/srd";
import { z } from "zod";

/**
 * Model-output schemas for the planning nodes (specs/031-dm-runtime contracts/
 * nodes.md, director.md). The step and effect schemas carry mechanics INPUTS
 * as data only: there is no field for a total, an applied amount or a
 * verdict. The engine owns every number (AC #5).
 */

const Reason = ReasonSchema;

/** The engine's `Ability`, taken from its own `check.roll` command schema. */
const checkRoll = EngineCommandSchema.options.find(
  (o) => o.shape.type.value === "check.roll",
);
if (!checkRoll || !("ability" in checkRoll.shape)) {
  throw new Error("engine check.roll command not found");
}
export const AbilitySchema = checkRoll.shape.ability as unknown as z.ZodType<
  "str" | "dex" | "con" | "int" | "wis" | "cha"
>;

/** The engine's `condition.apply` condition key (exhaustion excluded). */
const conditionApply = EngineCommandSchema.options.find(
  (o) => o.shape.type.value === "condition.apply",
);
if (!conditionApply || !("condition" in conditionApply.shape)) {
  throw new Error("engine condition.apply command not found");
}
export const ConditionKeySchema = conditionApply.shape
  .condition as unknown as z.ZodType<
  Exclude<
    Extract<
      z.infer<typeof EngineCommandSchema>,
      { type: "condition.apply" }
    >["condition"],
    "exhaustion"
  >
>;

export const RollModeSchema = z.enum(["normal", "advantage", "disadvantage"]);

/** The engine's `Amount`: a fixed value (where the SRD names one) or a dice expression. */
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

export const EffectSchema = z.discriminatedUnion("effect", [
  z.object({
    effect: z.literal("damage"),
    targetId: CombatantIdSchema,
    components: z
      .array(z.object({ amount: AmountSchema, damageType: DamageTypeSchema }))
      .min(1)
      .max(10),
    defenses: DefenseSetSchema.nullable(),
  }),
  z.object({
    effect: z.literal("heal"),
    targetId: CombatantIdSchema,
    amount: AmountSchema,
  }),
  z.object({
    effect: z.literal("condition"),
    op: z.enum(["apply", "remove"]),
    targetId: CombatantIdSchema,
    condition: ConditionKeySchema,
    source: z.string().min(1).max(100),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const StepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("none"), reason: Reason }),
  z.object({
    step: z.literal("check"),
    reason: Reason,
    combatantId: CombatantIdSchema.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]),
    ability: AbilitySchema,
    skill: z.string().max(40).nullable(),
    expression: z.string().min(1).max(200),
    mode: RollModeSchema,
    dc: z.number().int().min(1).max(40),
    autoFail: z.object({ reason: Reason }).nullable(),
    onSuccess: z.array(EffectSchema).max(4),
    onFailure: z.array(EffectSchema).max(4),
  }),
  z.object({
    step: z.literal("attack"),
    reason: Reason,
    attackerId: CombatantIdSchema.nullable(),
    targetId: CombatantIdSchema,
    expression: z.string().min(1).max(200),
    mode: RollModeSchema,
    targetAc: z.number().int().min(1).max(40).nullable(),
    onHit: z.array(EffectSchema).min(1).max(4),
  }),
  z.object({
    step: z.literal("effect"),
    reason: Reason,
    effects: z.array(EffectSchema).min(1).max(4),
  }),
  z.object({
    step: z.literal("roll"),
    reason: Reason,
    expression: z.string().min(1).max(200),
    mode: RollModeSchema,
  }),
]);
export type Step = z.infer<typeof StepSchema>;

export const InterpretReadingSchema = z
  .object({
    actionId: RefIdSchema.nullable(), // null only for the NPC turn
    intent: z.enum([
      "talk",
      "move",
      "check",
      "save",
      "attack",
      "spell",
      "help",
      "rest",
      "other",
    ]),
    uncertain: z.boolean(),
    needsAdjudication: z.boolean(),
    rulesQuestion: z.string().min(1).max(500).nullable(),
    clarify: z.string().min(1).max(200).nullable(),
    steps: z.array(StepSchema).max(6),
  })
  .superRefine((r, ctx) => {
    if (r.needsAdjudication && r.rulesQuestion === null) {
      ctx.addIssue({
        code: "custom",
        message: "rulesQuestion is required when needsAdjudication is true",
        path: ["rulesQuestion"],
      });
    }
  });
export type InterpretReading = z.infer<typeof InterpretReadingSchema>;

export const InterpretOutput = z.object({
  readings: z.array(InterpretReadingSchema).max(20),
});
export type InterpretOutput = z.infer<typeof InterpretOutput>;

export const DirectorOutput = z.object({
  beat: z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("resolve") }),
    z.object({
      decision: z.literal("hold"),
      companions: z.array(RefIdSchema).min(1).max(4),
      reason: z.string().min(1).max(300),
    }),
  ]),
  tableMode: z.discriminatedUnion("to", [
    z.object({ to: z.literal("stay") }),
    z.object({
      to: z.literal("turn"),
      encounterId: RefIdSchema,
      reason: z.string().min(1).max(300),
    }),
    z.object({
      to: z.literal("free"),
      reason: z.string().min(1).max(300),
    }),
  ]),
  trackers: z
    .array(
      z.object({
        trackerId: RefIdSchema,
        advance: z
          .number()
          .int()
          .min(-3)
          .max(3)
          .refine((n) => n !== 0),
        reason: z.string().min(1).max(300),
      }),
    )
    .max(4),
  scene: z.discriminatedUnion("status", [
    z.object({ status: z.literal("continue") }),
    z.object({
      status: z.literal("end"),
      outcome: z.enum(["goal-met", "retreat", "failed"]),
      reason: z.string().min(1).max(300),
    }),
  ]),
  pacing: z.object({
    tension: z.enum(["low", "rising", "high"]),
    spotlight: RefIdSchema.nullable(),
    beatId: z.string().max(64).nullable(),
  }),
  goalNote: z.string().max(300),
  companionPrompts: z.array(RefIdSchema).max(4),
});
export type DirectorOutput = z.infer<typeof DirectorOutput>;

export const AdjudicateModelOutput = z.object({
  ruling: z.string().min(1).max(600),
  citations: z
    .array(
      z.discriminatedUnion("source", [
        z.object({
          source: z.literal("library"),
          p: z.number().int().min(1),
          quote: z.string().min(1).max(500),
        }),
        z.object({
          source: z.literal("srd"),
          kind: SrdKind,
          id: z.string().min(1),
        }),
      ]),
    )
    .max(6),
  steps: z.array(StepSchema).min(1).max(6),
});
export type AdjudicateModelOutput = z.infer<typeof AdjudicateModelOutput>;
