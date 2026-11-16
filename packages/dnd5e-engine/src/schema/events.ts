import { PlacementSchema, SpaceSchema, ZoneIdSchema } from "@the-stacks/space";
import { z } from "zod";
import { DifficultySchema, OppositionRuleSchema } from "../derive.js";
import {
  AbilitySchema,
  AssistSchema,
  CombatantIdSchema,
  CombatantSchema,
  ConditionInstanceSchema,
  DamageTypeSchema,
  EncounterSchema,
  LifeStateSchema,
  SideSchema,
} from "./state.js";

const Reason = z.string().min(1).max(500);
const Id = CombatantIdSchema;
const V = z.literal(1);
const Int = z.number().int();
export const OutcomeBand = z.enum([
  "success",
  "success-at-cost",
  "failure",
  "severe-failure",
]);
export type OutcomeBand = z.infer<typeof OutcomeBand>;
const HpPair = z.object({ current: Int, temp: Int });

export const DiceTermResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dice"),
    sign: z.union([z.literal(1), z.literal(-1)]),
    count: Int,
    sides: Int,
    keep: z.object({ mode: z.enum(["highest", "lowest"]), n: Int }).nullable(),
    faces: z.array(Int),
    kept: z.array(z.boolean()),
    subtotal: Int,
  }),
  z.object({ kind: z.literal("modifier"), value: Int }),
]);

export const DamageComponentResultSchema = z.object({
  damageType: DamageTypeSchema,
  raw: z.number().int().min(0),
  applied: z.number().int().min(0),
  adjustment: z.enum([
    "none",
    "immune",
    "resisted",
    "vulnerable",
    "resisted-and-vulnerable",
  ]),
  rollIndex: Int.nullable(),
});

const Ability = AbilitySchema;
const Mode = z.enum(["normal", "advantage", "disadvantage"]);
const SlotRef = z.object({
  pool: z.enum(["standard", "pact"]),
  level: Int,
  expended: Int,
});
const TurnRef = z.object({
  round: Int,
  turnIndex: Int,
  combatantId: Id,
});

export const EngineEventSchema = z.discriminatedUnion("type", [
  // Marker events.
  z.object({
    type: z.literal("dice.rolled"),
    v: V,
    reason: Reason,
    expression: z.string(),
    mode: Mode,
    purpose: z.enum([
      "roll",
      "attack",
      "check",
      "save",
      "damage",
      "healing",
      "temp-hp",
      "initiative",
      "death-save",
      "hit-die",
    ]),
    critical: z.boolean(),
    combatantId: Id.nullable(),
    terms: z.array(DiceTermResultSchema),
    total: Int,
    natural: Int.nullable(),
  }),
  z.object({
    type: z.literal("attack.resolved"),
    v: V,
    reason: Reason,
    attackerId: Id.nullable(),
    targetId: Id,
    rollIndex: Int,
    ac: Int,
    acSource: z.enum(["command", "record"]),
    total: Int,
    natural: Int,
    outcome: z.enum(["hit", "miss", "critical-hit"]),
    reaction: z.boolean().optional(),
    attack: z.string().optional(),
    // Spec 083: the SRD spell id of a spell.cast attack.
    spellId: z.string().optional(),
  }),
  z.object({
    type: z.literal("check.resolved"),
    v: V,
    reason: Reason,
    combatantId: Id.nullable(),
    kind: z.enum(["ability-check", "saving-throw"]),
    ability: Ability,
    skill: z.string().nullable(),
    rollIndex: Int.nullable(),
    dc: Int,
    difficulty: DifficultySchema.optional(),
    // Spec 084: set when the DC derived from an opponent's stats.
    opposition: z
      .object({ opponentId: Id, rule: OppositionRuleSchema })
      .optional(),
    // Spec 120: set when the DC came from a monster feature.
    feature: z
      .object({ sourceId: Id, name: z.string().min(1).max(60) })
      .optional(),
    total: Int.nullable(),
    natural: Int.nullable(),
    autoFail: z.object({ reason: Reason }).nullable(),
    outcome: z.enum(["success", "failure"]),
    // Spec 070: optional so v1 rows written before it still parse.
    margin: Int.nullable().optional(),
    band: OutcomeBand.optional(),
    // Spec 083: the SRD spell id of a spell.cast save.
    spellId: z.string().optional(),
  }),
  z.object({
    type: z.literal("rest.completed"),
    v: V,
    reason: Reason,
    kind: z.enum(["short", "long"]),
    participants: z.array(Id),
  }),
  // State-change events.
  z.object({
    type: z.literal("combatant.added"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: z.null(),
    after: CombatantSchema,
  }),
  z.object({
    type: z.literal("combatant.removed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: CombatantSchema,
    after: z.null(),
  }),
  z.object({
    type: z.literal("hp.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    cause: z.enum(["damage", "healing", "temp-hp", "death-save", "rest"]),
    amount: Int,
    rawAmount: Int.nullable(),
    components: z.array(DamageComponentResultSchema).nullable(),
    defensesSource: z.enum(["command", "record"]).nullable(),
    critical: z.boolean(),
    // Spec 083: damage was halved (a successful save) before defenses.
    half: z.literal(true).optional(),
    rollIndex: Int.nullable(),
    before: HpPair,
    after: HpPair,
  }),
  z.object({
    type: z.literal("life-state.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: LifeStateSchema,
    after: LifeStateSchema,
  }),
  z.object({
    type: z.literal("death-saves.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    rollIndex: Int.nullable(),
    before: z.object({ successes: Int, failures: Int }),
    after: z.object({ successes: Int, failures: Int }),
  }),
  z.object({
    type: z.literal("condition.applied"),
    v: V,
    reason: Reason,
    combatantId: Id,
    conditionSeq: z.object({ before: Int, after: Int }),
    before: z.null(),
    after: ConditionInstanceSchema,
  }),
  z.object({
    type: z.literal("condition.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: ConditionInstanceSchema,
    after: ConditionInstanceSchema,
  }),
  z.object({
    type: z.literal("condition.removed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    cause: z.enum(["command", "expired", "healed", "encounter-ended", "rest"]),
    before: ConditionInstanceSchema,
    after: z.null(),
  }),
  z.object({
    type: z.literal("assist.granted"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: z.null(),
    after: AssistSchema,
  }),
  z.object({
    type: z.literal("assist.ended"),
    v: V,
    reason: Reason,
    combatantId: Id,
    cause: z.enum(["used", "expired", "replaced", "encounter-ended"]),
    before: AssistSchema,
    after: z.null(),
  }),
  z.object({
    type: z.literal("hit-dice.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: z.object({ die: Int, remaining: Int }),
    after: z.object({ die: Int, remaining: Int }),
  }),
  z.object({
    type: z.literal("spell-slots.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: SlotRef,
    after: SlotRef,
  }),
  z.object({
    type: z.literal("space.defined"),
    v: V,
    reason: Reason,
    before: SpaceSchema.nullable(),
    after: SpaceSchema,
  }),
  z.object({
    type: z.literal("combatant.sided"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: SideSchema.nullable(),
    after: SideSchema,
  }),
  z.object({
    type: z.literal("combatant.placed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: PlacementSchema.nullable(),
    after: PlacementSchema.nullable(),
  }),
  z.object({
    type: z.literal("combatant.moved"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: PlacementSchema,
    after: PlacementSchema,
    path: z.array(ZoneIdSchema).min(2),
    feet: Int.min(0),
  }),
  z.object({
    type: z.literal("encounter.started"),
    v: V,
    reason: Reason,
    before: z.null(),
    after: EncounterSchema,
  }),
  z.object({
    type: z.literal("encounter.changed"),
    v: V,
    reason: Reason,
    combatantId: Id,
    before: EncounterSchema,
    after: EncounterSchema,
  }),
  z.object({
    type: z.literal("turn.advanced"),
    v: V,
    reason: Reason,
    skipped: z.array(Id),
    before: TurnRef,
    after: TurnRef,
  }),
  z.object({
    type: z.literal("encounter.ended"),
    v: V,
    reason: Reason,
    before: EncounterSchema,
    after: z.null(),
  }),
]);

export type DiceTermResult = z.infer<typeof DiceTermResultSchema>;
export type EngineEvent = z.infer<typeof EngineEventSchema>;
export type EventOf<T extends EngineEvent["type"]> = Extract<
  EngineEvent,
  { type: T }
>;
