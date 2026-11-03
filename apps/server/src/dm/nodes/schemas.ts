import {
  DamageTypeSchema,
  DefenseSetSchema,
  EngineCommandSchema,
  type Skill,
} from "@the-stacks/dnd5e-engine";
import {
  CombatantIdSchema,
  PresenceReasonSchema,
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
const conditionEnum = conditionApply.shape.condition as unknown as z.ZodEnum<
  Record<string, string>
>;
type ConditionKey = Exclude<
  Extract<
    z.infer<typeof EngineCommandSchema>,
    { type: "condition.apply" }
  >["condition"],
  "exhaustion"
>;
export const CONDITION_KEYS = conditionEnum.options as readonly ConditionKey[];
export const ConditionKeySchema =
  conditionEnum as unknown as z.ZodType<ConditionKey>;

/**
 * The engine's `Skill` key list, taken from its own `check.roll` command
 * (default and nullable unwrapped). Throws at load when it is not an enum.
 */
if (!("skill" in checkRoll.shape)) {
  throw new Error("engine check.roll skill not found");
}
function unwrapSkill(schema: z.ZodType): z.ZodEnum<Record<string, string>> {
  let inner: z.ZodType = schema;
  for (;;) {
    if (inner instanceof z.ZodDefault) {
      inner = inner.unwrap() as z.ZodType;
    } else if (inner instanceof z.ZodNullable) {
      inner = inner.unwrap() as z.ZodType;
    } else break;
  }
  if (!(inner instanceof z.ZodEnum)) {
    throw new Error("engine check.roll skill is not an enum");
  }
  return inner as z.ZodEnum<Record<string, string>>;
}
const skillEnum = unwrapSkill(checkRoll.shape.skill as z.ZodType);
export const SkillSchema = skillEnum as unknown as z.ZodType<Skill>;
export const SKILL_KEYS = skillEnum.options as readonly Skill[];

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
  // Scene presence (specs/048-scene-presence plan D5, R6). RefIdSchema and
  // CombatantIdSchema share one regex, so one id grammar serves both.
  // Strict: the reason fixes the new value, so an `after` field is refused.
  z.strictObject({
    effect: z.literal("presence"),
    targetId: CombatantIdSchema,
    reason: PresenceReasonSchema,
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

/** Spec 070 D1: one consequence text per outcome band, declared before the dice. */
const StakeText = z.string().min(1).max(200);
export const StakesSchema = z.object({
  success: StakeText.nullable(), // TASK-0170 makes this required
  cost: StakeText.nullable(), // required on an ability check
  failure: StakeText, // always required
  severe: StakeText.nullable(), // required on an ability check
});
export type Stakes = z.infer<typeof StakesSchema>;

export const StepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("none"), reason: Reason }),
  z.object({
    step: z.literal("check"),
    reason: Reason,
    combatantId: CombatantIdSchema.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]),
    ability: AbilitySchema,
    skill: SkillSchema.nullable(),
    expression: z.string().min(1).max(200),
    mode: RollModeSchema,
    dc: z.number().int().min(1).max(40),
    autoFail: z.object({ reason: Reason }).nullable(),
    onSuccess: z.array(EffectSchema).max(4),
    onFailure: z.array(EffectSchema).max(4),
    stakes: StakesSchema,
    onCost: z.array(EffectSchema).max(4).default([]),
    onSevere: z.array(EffectSchema).max(4).default([]),
    newRisk: z.string().min(1).max(200).nullable().default(null),
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
  z.object({
    step: z.literal("move"),
    reason: Reason,
    combatantId: CombatantIdSchema,
    leavesReachOf: z.array(CombatantIdSchema).max(6),
  }),
]);
export type Step = z.infer<typeof StepSchema>;

/** An ability check names a cost and a severe consequence; a saving throw may not. */
function requireAbilityStakes(
  steps: readonly Step[],
  ctx: z.RefinementCtx,
  base: (string | number)[],
): void {
  steps.forEach((step, i) => {
    if (step.step !== "check" || step.kind !== "ability-check") return;
    for (const key of ["cost", "severe"] as const) {
      if (step.stakes[key] === null) {
        ctx.addIssue({
          code: "custom",
          message: `an ability check needs stakes.${key}`,
          path: [...base, i, "stakes", key],
        });
      }
    }
  });
}

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
    followUps: z.array(z.string().min(1).max(200)).max(6).default([]),
  })
  .superRefine((r, ctx) => {
    if (r.needsAdjudication && r.rulesQuestion === null) {
      ctx.addIssue({
        code: "custom",
        message: "rulesQuestion is required when needsAdjudication is true",
        path: ["rulesQuestion"],
      });
    }
    requireAbilityStakes(r.steps, ctx, ["steps"]);
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
          .refine((n) => n !== 0, {
            message: "advance must be a non-zero integer from -3 to 3",
          }),
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
  /** Offstage seed NPCs now on screen (specs/078-revealed-npc-present). */
  arrivals: z.array(RefIdSchema).max(4).optional(),
});
export type DirectorOutput = z.infer<typeof DirectorOutput>;

/** The talk-turn `react` output (specs/065-talk-triggers plan D4). */
export const ReactOutput = z
  .object({
    outcome: z.enum(["none", "reply", "scene", "escalate"]),
    triggers: z
      .array(
        z.object({
          kind: z.enum([
            "addressed",
            "mentioned",
            "overheard",
            "narrator",
            "hostile",
          ]),
          actorId: RefIdSchema.nullable(),
        }),
      )
      .max(8),
    speaker: RefIdSchema.nullable(),
    text: z.string().max(1200),
    encounterId: RefIdSchema.nullable(),
    companionPrompts: z.array(RefIdSchema).max(2),
    reason: z.string().min(1).max(300),
  })
  .superRefine((o, ctx) => {
    if (o.outcome === "reply" && !o.speaker)
      ctx.addIssue({
        code: "custom",
        message: "reply needs a speaker",
        path: ["speaker"],
      });
    if (o.outcome === "escalate" && !o.encounterId)
      ctx.addIssue({
        code: "custom",
        message: "escalate needs an encounterId",
        path: ["encounterId"],
      });
    if (o.outcome === "none" && o.text !== "")
      ctx.addIssue({
        code: "custom",
        message: "none needs empty text",
        path: ["text"],
      });
  });
export type ReactOutput = z.infer<typeof ReactOutput>;

export const AdjudicateModelOutput = z
  .object({
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
  })
  .superRefine((o, ctx) => requireAbilityStakes(o.steps, ctx, ["steps"]));
export type AdjudicateModelOutput = z.infer<typeof AdjudicateModelOutput>;
