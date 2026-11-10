// Contract §2–§5: PlanState, PlanResult, PlannedCommand, PlanFact, RulingRequest and their schemas.
import {
  AbilitySchema,
  DifficultySchema,
  type EngineCommand,
  EngineCommandSchema,
  EngineStateSchema,
  OppositionRuleSchema,
  type RefusalCodeSchema,
  SkillSchema,
} from "@the-stacks/dnd5e-engine";
import {
  type Intent,
  type IntentRefusalCodeSchema,
  IntentSchema,
} from "@the-stacks/intent";
import { BandSchema } from "@the-stacks/space";
import { z } from "zod";

const RollModeSchema = z.enum(["normal", "advantage", "disadvantage"]);

export const SideSchema = z.enum(["party", "hostile", "neutral"]);
export type Side = z.infer<typeof SideSchema>;

export const PlanActorSchema = z.strictObject({
  id: z.string().min(1),
  combatantId: z.string().min(1).nullable(),
  side: SideSchema,
  presence: z.enum(["present", "yielded", "absent"]),
  seen: z.boolean(),
  controller: z.enum(["human", "ai"]),
});
export type PlanActor = z.infer<typeof PlanActorSchema>;

type CombatantInit = Extract<
  EngineCommand,
  { type: "combatant.add" }
>["combatant"];
// The engine's `combatant.add` payload schema, reused so the two never drift.
const CombatantInitSchema = (
  EngineCommandSchema.options.find(
    (o) => o.shape.type.value === "combatant.add",
  ) as unknown as { shape: { combatant: z.ZodType<CombatantInit, unknown> } }
).shape.combatant;

// ---------------------------------------------------------------------------
// PlanFact (contract §4): every value is code-chosen data, never model text.

export const PlanFactSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("rule"), rule: z.string().min(1) }),
  z.strictObject({
    kind: z.literal("dc"),
    source: z.enum(["difficulty", "dc", "opposition"]),
    difficulty: DifficultySchema.optional(),
    dc: z.number().int().optional(),
    opposition: z
      .strictObject({ opponentId: z.string(), rule: OppositionRuleSchema })
      .optional(),
  }),
  z.strictObject({
    kind: z.literal("reach"),
    band: BandSchema,
    use: z.enum(["melee", "normal", "long"]),
  }),
  z.strictObject({ kind: z.literal("pull-in"), actorId: z.string() }),
  z.strictObject({
    kind: z.literal("reaction"),
    reactorId: z.string(),
    trigger: z.literal("leaves-zone"),
  }),
  z.strictObject({
    kind: z.literal("ruling"),
    requestId: z.string(),
    decision: z.enum(["accept", "reject", "amend"]),
    by: z.enum(["dm", "ai:dm"]),
    reason: z.string().optional(),
  }),
  z.strictObject({
    kind: z.literal("no-roll"),
    reason: z.literal("uncontested"),
  }),
  z.strictObject({
    kind: z.literal("ignored"),
    field: z.enum(["dc", "difficulty"]),
    why: z.literal("player-seat"),
  }),
  z.strictObject({
    kind: z.literal("unserved"),
    part: z.string(),
    owner: z.string(),
  }),
]);
export type PlanFact = z.infer<typeof PlanFactSchema>;

// ---------------------------------------------------------------------------
// RulingRequest (contract §5)

export const RulingRequestSchema = z.strictObject({
  requestId: z.string().min(1),
  intent: IntentSchema,
  ask: z.enum(["difficulty", "outcome"]),
  roll: z
    .strictObject({
      kind: z.enum(["ability-check", "saving-throw"]),
      combatantId: z.string(),
      ability: AbilitySchema,
      skill: SkillSchema.nullable(),
      mode: RollModeSchema,
    })
    .nullable(),
  opposition: z
    .strictObject({
      opponentId: z.string(),
      rules: z.array(OppositionRuleSchema),
    })
    .nullable(),
  stakes: z.enum(["self", "other"]),
  rule: z.string().nullable(),
});
export type RulingRequest = Omit<
  z.infer<typeof RulingRequestSchema>,
  "intent"
> & { intent: Intent };

// ---------------------------------------------------------------------------
// PlanState (contract §2)

export const PlanStateSchema = z.strictObject({
  engine: EngineStateSchema,
  actors: z.record(z.string(), PlanActorSchema),
  casters: z.record(
    z.string(),
    z.strictObject({
      level: z.number().int().min(1).max(20),
      spells: z.array(z.string()),
    }),
  ),
  srdSpellIds: z.array(z.string()),
  inits: z.record(z.string(), CombatantInitSchema),
  openRequests: z.record(z.string(), RulingRequestSchema),
  tableRules: z.strictObject({
    outcomeBands: z.boolean(),
    naturals: z.boolean(),
  }),
});
export type PlanState = z.infer<typeof PlanStateSchema>;

// ---------------------------------------------------------------------------
// PlanResult (contract §3)

export type StepOutcome =
  | "hit"
  | "miss"
  | "critical-hit"
  | "success"
  | "success-at-cost"
  | "failure"
  | "severe-failure";

export type PlannedCommand = {
  command: EngineCommand;
  when?: { step: number; outcomes: StepOutcome[] };
};

export type PlanRefusal =
  | {
      source: "planner";
      code: z.infer<typeof IntentRefusalCodeSchema>;
      message: string;
      details?: Record<string, unknown>;
    }
  | {
      source: "engine";
      code: z.infer<typeof RefusalCodeSchema>;
      message: string;
      details?: Record<string, unknown>;
    };

export type PlanResult =
  | { kind: "commands"; commands: PlannedCommand[]; facts: PlanFact[] }
  | { kind: "refusal"; refusal: PlanRefusal; facts: PlanFact[] }
  | { kind: "needs_ruling"; request: RulingRequest; facts: PlanFact[] };
