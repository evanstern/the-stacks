import { z } from "zod";
import { EngineEventSchema } from "./events.js";

export const RefusalCodeSchema = z.enum([
  "INVALID_STATE",
  "INVALID_COMMAND",
  "INVALID_DICE_EXPRESSION",
  "DICE_LIMIT_EXCEEDED",
  "ADVANTAGE_NOT_APPLICABLE",
  "D20_TERM_REQUIRED",
  "UNKNOWN_COMBATANT",
  "DUPLICATE_COMBATANT",
  "DUPLICATE_PARTICIPANT",
  "COMBATANT_IN_ENCOUNTER",
  "TARGET_DEAD",
  "TARGET_AC_UNKNOWN",
  "NOT_DYING",
  "TEMP_HP_NOT_HIGHER",
  "CONDITION_ALREADY_PRESENT",
  "CONDITION_NOT_PRESENT",
  "EXHAUSTION_OUT_OF_RANGE",
  "ENCOUNTER_ACTIVE",
  "NO_ACTIVE_ENCOUNTER",
  "REACTION_SPENT",
  "STEP_ACTOR_MISMATCH",
  "ALREADY_IN_ENCOUNTER",
  "NO_ELIGIBLE_COMBATANT",
  "INSUFFICIENT_HIT_DICE",
  "LONG_REST_REQUIRES_HP",
  "SLOT_LEVEL_UNAVAILABLE",
  "NO_SLOT_AVAILABLE",
  "SLOT_NOT_EXPENDED",
  "ACTOR_UNABLE",
  "REASON_CONTRADICTS_STATE",
  "STAT_UNDEFINED",
  "SPELL_UNRESOLVED",
  "SPELL_UNKNOWN",
  "SPELL_NOT_PREPARED",
  "NOT_PROFICIENT",
]);

export const RefusalSchema = z.object({
  code: RefusalCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type RefusalCode = z.infer<typeof RefusalCodeSchema>;
export type Refusal = z.infer<typeof RefusalSchema>;

export type RefusalResult = { ok: false; refusal: Refusal };

export function refuse(
  code: RefusalCode,
  message: string,
  details?: Record<string, unknown>,
): RefusalResult {
  const refusal: Refusal =
    details === undefined ? { code, message } : { code, message, details };
  return { ok: false, refusal };
}

export const EngineResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    events: z.array(EngineEventSchema).min(1),
  }),
  z.object({ ok: z.literal(false), refusal: RefusalSchema }),
]);

export type EngineResult = z.infer<typeof EngineResultSchema>;
