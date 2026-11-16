import { PlacementSchema, SpaceSchema, ZoneIdSchema } from "@the-stacks/space";
import { z } from "zod";
import { DifficultySchema, OppositionRuleSchema } from "../derive.js";
import {
  AbilitySchema,
  AmountSchema,
  CombatantIdSchema,
  CombatantStatsSchema,
  ConditionKeySchema,
  DamageTypeSchema,
  DefenseSetSchema,
  ExpiryPointSchema,
  HitDieSchema,
  SideSchema,
  SkillSchema,
} from "./state.js";

const Ability = AbilitySchema;
const Amount = AmountSchema;
const Reason = z.string().min(1).max(500);
const Id = CombatantIdSchema;
const RollMode = z
  .enum(["normal", "advantage", "disadvantage"])
  .default("normal");
const SlotLevel = z.number().int().min(1).max(9);
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
  stats: CombatantStatsSchema.optional(),
  placement: PlacementSchema.optional(),
  speed: z.number().int().min(0).max(200).optional(),
  side: SideSchema.optional(),
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
    // Spec 082: exactly one of expression (explicit) and attack (a stats entry name).
    expression: z.string().min(1).max(200).optional(),
    attack: z.string().min(1).max(60).optional(),
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
    // Spec 082: expression is explicit-only; without it the engine derives the modifier.
    expression: z.string().min(1).max(200).optional(),
    mode: RollMode,
    // Exactly one of dc and difficulty (checked in the handler, plan R8).
    dc: z.number().int().min(1).max(40).optional(),
    difficulty: DifficultySchema.optional(),
    // Spec 084: the DC derives from an opponent's stats (a third DC source; exactly one of the three).
    opposition: z
      .object({ opponentId: Id, rule: OppositionRuleSchema })
      .optional(),
    autoFail: z.object({ reason: Reason }).nullable().default(null),
    // Spec 070: auto-success (a free retry) and the table's house rules.
    // The engine defaults stay SRD-pure; the DM runtime sends the seed's values.
    // Optional, not defaulted: a Zod default would make the field required on the
    // output type and break every existing literal command (session-model recipes).
    autoSuccess: z.object({ reason: Reason }).nullable().optional(),
    houseRules: z
      .object({ outcomeBands: z.boolean(), naturals: z.boolean() })
      .optional(),
    reason: Reason,
  }),
  z.object({
    type: z.literal("combatant.add"),
    combatant: CombatantInit,
    reason: Reason,
  }),
  z.object({
    // Spec 099: set a combatant's allegiance.
    type: z.literal("combatant.side"),
    combatantId: Id,
    side: SideSchema,
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
    // Spec 083: one spell by SRD id; the engine resolves attack, save, dice and effects.
    type: z.literal("spell.cast"),
    casterId: Id,
    spellId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    targetId: Id,
    slotLevel: SlotLevel.nullable(),
    casterLevel: z.number().int().min(1).max(20),
    houseRules: z
      .object({ outcomeBands: z.boolean(), naturals: z.boolean() })
      .optional(),
    reason: Reason,
  }),
  z.object({
    // Spec 084: the Help action. The ally (or the distracted enemy) holds the assist.
    type: z.literal("help.grant"),
    helperId: Id,
    assist: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("ability-check"),
        allyId: Id,
        skill: SkillSchema,
      }),
      z.object({ kind: z.literal("attack"), targetId: Id }),
    ]),
    reason: Reason,
  }),
  z.object({
    // Spec 094: set or replace the scene's zone graph.
    type: z.literal("space.define"),
    space: SpaceSchema,
    reason: Reason,
  }),
  z.object({
    // Spec 094: DM placement, arrival, flight. No edge or speed check. null clears.
    type: z.literal("combatant.place"),
    combatantId: Id,
    zoneId: ZoneIdSchema.nullable(),
    reason: Reason,
  }),
  z.object({
    type: z.literal("move"),
    combatantId: Id,
    toZoneId: ZoneIdSchema,
    reason: Reason,
  }),
  z.object({
    // Spec 099: leave the order and the zone in one command.
    type: z.literal("combatant.depart"),
    combatantId: Id,
    reason: Reason,
  }),
  z.object({
    // Spec 099: stand from prone for half Speed.
    type: z.literal("stand"),
    combatantId: Id,
    reason: Reason,
  }),
  z.object({
    type: z.literal("movement.action"),
    combatantId: Id,
    action: z.enum(["dash", "disengage"]),
    reason: Reason,
  }),
  z.object({
    // Spec 117: spend the active combatant's Action or Bonus Action. The planner adds it last.
    type: z.literal("action.spend"),
    combatantId: Id,
    cost: z.enum(["action", "bonus-action"]),
    reason: Reason,
  }),
  z.object({
    // Spec 117: the Dodge action. It spends nothing; the planner appends action.spend.
    type: z.literal("dodge"),
    combatantId: Id,
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
