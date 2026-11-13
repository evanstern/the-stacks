import {
  DamageTypeSchema,
  DefenseSetSchema,
  DifficultySchema,
  EngineCommandSchema,
  OppositionRuleSchema,
  oppositionCovers,
  type Skill,
} from "@the-stacks/dnd5e-engine";
import {
  type IntentKind,
  KIND_RULES,
  paramsSchemaOf,
  TargetRefSchema,
} from "@the-stacks/intent";
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
  success: StakeText, // spec 080: the concrete outcome of this attempt, always written
  cost: StakeText.nullable(), // required on an ability check
  failure: StakeText, // always required
  severe: StakeText.nullable(), // required on an ability check
});
export type Stakes = z.infer<typeof StakesSchema>;

/** Spec 080 D1: `<beatId>#<n>`, the n-th discoverable clue of a seed beat (1-based). */
export const ClueRefSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.:-]{0,63}#[1-8]$/);

export { DifficultySchema };

/** Spec 082 D6: advantage or disadvantage from a source no condition states, with its reason. */
const CircumstanceSchema = z
  .object({ mode: z.enum(["advantage", "disadvantage"]), reason: Reason })
  .nullable()
  .default(null);

/** Spec 084 D9: the DC derives from this creature's stats; the model names it, never a number. */
const OppositionSchema = z.strictObject({
  opposedBy: CombatantIdSchema,
  rule: OppositionRuleSchema,
});

export const StepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("none"), reason: Reason }),
  z.strictObject({
    step: z.literal("check"),
    reason: Reason,
    combatantId: CombatantIdSchema.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]),
    ability: AbilitySchema,
    skill: SkillSchema.nullable(),
    difficulty: z.union([DifficultySchema, OppositionSchema]),
    circumstance: CircumstanceSchema,
    autoFail: z.object({ reason: Reason }).nullable(),
    onSuccess: z.array(EffectSchema).max(4),
    onFailure: z.array(EffectSchema).max(4),
    stakes: StakesSchema,
    reveals: ClueRefSchema.nullable().default(null),
    onCost: z.array(EffectSchema).max(4).default([]),
    onSevere: z.array(EffectSchema).max(4).default([]),
    newRisk: z.string().min(1).max(200).nullable().default(null),
  }),
  z.strictObject({
    step: z.literal("attack"),
    reason: Reason,
    attackerId: CombatantIdSchema,
    targetId: CombatantIdSchema,
    attack: z.string().min(1).max(60),
    circumstance: CircumstanceSchema,
    onHit: z.array(EffectSchema).max(4),
  }),
  // Spec 083 D4: the engine resolves the spell's attack, save, dice and effects.
  z.strictObject({
    step: z.literal("spell"),
    reason: Reason,
    casterId: CombatantIdSchema,
    spellId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    slotLevel: z.number().int().min(1).max(9).nullable(),
    targetId: CombatantIdSchema,
  }),
  // Spec 084 D9: the helper takes the Help action; the engine applies and ends the assist.
  z.strictObject({
    step: z.literal("help"),
    reason: Reason,
    helperId: CombatantIdSchema,
    assist: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("ability-check"),
        allyId: CombatantIdSchema,
        skill: SkillSchema,
      }),
      z.strictObject({
        kind: z.literal("attack"),
        targetId: CombatantIdSchema,
      }),
    ]),
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

/**
 * An ability check names a cost and a severe consequence; a saving throw may not.
 * Spec 082: an attack's `onHit` carries no damage (the engine applies the attack entry's).
 */
function refineSteps(
  steps: readonly Step[],
  ctx: z.RefinementCtx,
  base: (string | number)[],
): void {
  steps.forEach((step, i) => {
    if (step.step === "attack") {
      step.onHit.forEach((e, j) => {
        if (e.effect === "damage") {
          ctx.addIssue({
            code: "custom",
            message:
              "an attack's onHit carries no damage effect: the engine applies the attack's damage",
            path: [...base, i, "onHit", j],
          });
        }
      });
    }
    if (step.step === "help") {
      const other =
        step.assist.kind === "ability-check"
          ? step.assist.allyId
          : step.assist.targetId;
      if (other === step.helperId) {
        ctx.addIssue({
          code: "custom",
          message: "a helper cannot help itself",
          path: [...base, i, "assist"],
        });
      }
    }
    if (step.step === "check" && typeof step.difficulty !== "string") {
      const { opposedBy, rule } = step.difficulty;
      if (opposedBy === step.combatantId) {
        ctx.addIssue({
          code: "custom",
          message: "a check cannot be opposed by its own checker",
          path: [...base, i, "difficulty", "opposedBy"],
        });
      }
      if (!oppositionCovers(rule, step.kind, step.ability, step.skill)) {
        ctx.addIssue({
          code: "custom",
          message: `rule ${rule} does not cover this check`,
          path: [...base, i, "difficulty", "rule"],
        });
      }
    }
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

/**
 * The Intent kinds interpret may emit (specs/104 plan D1). The monster-only kinds
 * are TASK-0299's. ponytail: add a kind here when its planner owner lands.
 */
export const INTERPRET_KINDS = [
  "attempt",
  "check",
  "save",
  "contest",
  "attack",
  "cast",
  "help",
  "hide",
  "search",
  "grapple",
  "shove",
  "use_object",
  "move",
  "stand",
  "drop_prone",
  "dash",
  "dodge",
  "disengage",
] as const satisfies readonly IntentKind[];
export type InterpretKind = (typeof INTERPRET_KINDS)[number];

/** The `params` shape of a kind with the model-chosen `dc` left out (CR-004). */
function bodyParams(kind: IntentKind): z.ZodType {
  const p = paramsSchemaOf(kind) as unknown as z.ZodObject;
  const { dc: _dc, ...shape } = p.shape as Record<string, z.ZodType>;
  // Refinements are dropped; the stamped Intent re-runs the full IntentSchema.
  return z.strictObject(shape);
}

const IntentBodyMembers = INTERPRET_KINDS.map((kind) => {
  const t = KIND_RULES[kind].targets;
  return z.strictObject({
    kind: z.literal(kind),
    targets: z.array(TargetRefSchema).min(t.min).max(t.max),
    params: bodyParams(kind),
    text:
      KIND_RULES[kind].text === "required"
        ? z.string().trim().min(1).max(4000)
        : z.string().trim().min(1).max(4000).optional(),
  });
});
/** One Intent body: no id, actor, source or commit; code stamps those. */
export const IntentBodySchema = z.discriminatedUnion(
  "kind",
  IntentBodyMembers as unknown as [
    (typeof IntentBodyMembers)[number],
    ...(typeof IntentBodyMembers)[number][],
  ],
);
export type IntentBody = z.infer<typeof IntentBodySchema>;

/** The act that replaces a null act for the active companion in turn mode. */
export const HOLD_ACT_TEXT = "holds position and watches for an opening";

/**
 * Spec 107 D1: the kinds a companion may declare on its own turn. No check-family kind: a
 * check needs model-written stakes, which ride only on the interpret path (spec OQ-3).
 */
export const COMPANION_TURN_KINDS = [
  "attack",
  "cast",
  "help",
  "grapple",
  "shove",
  "move",
  "dash",
  "disengage",
  "stand",
  "drop_prone",
  "attempt",
] as const satisfies readonly InterpretKind[];
const CompanionMembers = IntentBodyMembers.filter((m) =>
  (COMPANION_TURN_KINDS as readonly string[]).includes(m.shape.kind.value),
);
export const CompanionIntentBodySchema = z.discriminatedUnion(
  "kind",
  CompanionMembers as unknown as [
    (typeof IntentBodyMembers)[number],
    ...(typeof IntentBodyMembers)[number][],
  ],
);
export type CompanionIntentBody = z.infer<typeof CompanionIntentBodySchema>;

/** The kinds a `beside` block (stakes, band effects, reveals) may ride on. */
export const BESIDE_KINDS: readonly IntentKind[] = [
  "check",
  "save",
  "contest",
  "search",
  "hide",
];

/** Spec 070/080 data beside a check Intent, until a card puts stakes on Intents (OQ-6). */
export const BesideSchema = z.strictObject({
  stakes: StakesSchema,
  onSuccess: z.array(EffectSchema).max(4).default([]),
  onFailure: z.array(EffectSchema).max(4).default([]),
  onCost: z.array(EffectSchema).max(4).default([]),
  onSevere: z.array(EffectSchema).max(4).default([]),
  newRisk: z.string().min(1).max(200).nullable().default(null),
  reveals: ClueRefSchema.nullable().default(null),
  autoFail: z.object({ reason: Reason }).nullable().default(null),
});
export type Beside = z.infer<typeof BesideSchema>;

export const InterpretStageSchema = z
  .strictObject({
    intent: IntentBodySchema,
    beside: BesideSchema.nullable().default(null),
  })
  .superRefine((st, ctx) => {
    if (!st.beside) return;
    if (!BESIDE_KINDS.includes(st.intent.kind)) {
      ctx.addIssue({
        code: "custom",
        message: `beside data does not ride on a ${st.intent.kind} Intent`,
        path: ["beside"],
      });
      return;
    }
    // Spec 070: an ability check names a cost and a severe consequence; a save may not.
    if (st.intent.kind === "save") return;
    for (const key of ["cost", "severe"] as const) {
      if (st.beside.stakes[key] === null) {
        ctx.addIssue({
          code: "custom",
          message: `an ability check needs stakes.${key}`,
          path: ["beside", "stakes", key],
        });
      }
    }
  });
export type InterpretStage = z.infer<typeof InterpretStageSchema>;

/** Specs/104 FR-001: one reading per beat item, a list of Intent stages. */
export const InterpretReadingSchema = z.strictObject({
  actionId: RefIdSchema.nullable(), // null only for the NPC turn
  stages: z.array(InterpretStageSchema).max(6),
  clarify: z.string().min(1).max(200).nullable(),
  followUps: z.array(z.string().min(1).max(200)).max(6).default([]),
  say: z.string().min(1).max(200).nullable().optional(), // a monster's spoken line (specs/081)
});
export type InterpretReading = z.infer<typeof InterpretReadingSchema>;

/** The pre-Intent reading: resumed checkpoints and the legacy resolve path (plan D7). */
export const LegacyInterpretReadingSchema = z
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
    say: z.string().min(1).max(200).nullable().optional(), // a monster's spoken line (specs/081)
  })
  .superRefine((r, ctx) => {
    if (r.needsAdjudication && r.rulesQuestion === null) {
      ctx.addIssue({
        code: "custom",
        message: "rulesQuestion is required when needsAdjudication is true",
        path: ["rulesQuestion"],
      });
    }
    refineSteps(r.steps, ctx, ["steps"]);
  });
export type LegacyInterpretReading = z.infer<
  typeof LegacyInterpretReadingSchema
>;

export const InterpretOutput = z.object({
  readings: z.array(InterpretReadingSchema).max(20),
});
export type InterpretOutput = z.infer<typeof InterpretOutput>;

/** A reading in a turn: the Intent shape, or the pre-Intent shape of a resumed checkpoint (plan D7). */
export type AnyInterpretReading = InterpretReading | LegacyInterpretReading;
/** What the interpret node returns and a checkpoint stores. */
export interface InterpretResult {
  readings: AnyInterpretReading[];
}
/** True for the Intent shape; the legacy shape has `steps` instead of `stages`. */
export const hasStages = (r: AnyInterpretReading): r is InterpretReading =>
  "stages" in r;

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

/** One model confirm item (spec 066 FR-011): the acting character, the DM's wording, an Intent body. */
export const ConfirmItem = z.strictObject({
  /** The acting character; null for a party item (an `attempt` with scope `party`). */
  characterId: RefIdSchema.nullable(),
  text: z.string().min(1).max(500),
  body: IntentBodySchema,
});
export type ConfirmItem = z.infer<typeof ConfirmItem>;

/** The talk-turn `react` output (specs/065-talk-triggers plan D4; spec 066 D3 adds `confirm`, `answer`). */
export const ReactOutput = z
  .object({
    outcome: z.enum(["none", "reply", "scene", "escalate", "confirm"]),
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
    /** Spec 066: 1 to 4 items for a `confirm`; empty otherwise. */
    confirm: z.array(ConfirmItem).max(4).default([]),
    /** Spec 066: the one `ask_dm` answer, or null. */
    answer: z.string().max(1200).nullable().default(null),
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
    if ((o.outcome === "none" || o.outcome === "confirm") && o.text !== "")
      ctx.addIssue({
        code: "custom",
        message: `${o.outcome} needs empty text`,
        path: ["text"],
      });
    if (o.outcome === "confirm" && o.confirm.length === 0)
      ctx.addIssue({
        code: "custom",
        message: "confirm needs 1 to 4 items",
        path: ["confirm"],
      });
    if (o.outcome !== "confirm" && o.confirm.length > 0)
      ctx.addIssue({
        code: "custom",
        message: "only a confirm outcome carries items",
        path: ["confirm"],
      });
    for (const [i, item] of o.confirm.entries()) {
      const party =
        item.body.kind === "attempt" &&
        (item.body.params as { scope?: string }).scope === "party";
      if (party !== (item.characterId === null))
        ctx.addIssue({
          code: "custom",
          message: "characterId is null exactly for a party attempt",
          path: ["confirm", i, "characterId"],
        });
    }
  });
export type ReactOutput = z.infer<typeof ReactOutput>;
