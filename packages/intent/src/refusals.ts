// Contract §9. One enum, so every surface renders the same reasons.
import { z } from "zod";

export const PARSE_AND_SCHEMA_CODES = [
  "PARSE_UNKNOWN_VERB",
  "PARSE_MISSING_ARGUMENT",
  "PARSE_UNEXPECTED_TOKEN",
  "PARSE_BAD_TARGET",
  "PARSE_BAD_VALUE",
  "PARSE_UNCLOSED",
  "INTENT_SCHEMA",
  "INTENT_CHANNEL_MISMATCH",
  "MODEL_NUMBER",
] as const;

// Reserved here; raised by the gate and planner (N-02, N-03).
export const GATE_AND_PLANNER_CODES = [
  "DRAFT_NOT_ACCEPTED",
  "INTENT_EXISTS",
  "INTENT_NOT_DECLARED",
  "NOT_YOUR_ACTOR",
  "DM_SEAT_REQUIRED",
  "KIND_UNSERVED",
  "NOT_YOUR_TURN",
  "NO_ACTION_LEFT",
  "NO_BONUS_ACTION_LEFT",
  "NO_REACTION_LEFT",
  "NO_MOVEMENT_LEFT",
  "OUT_OF_REACH",
  "OUT_OF_RANGE",
  "TARGET_NOT_PRESENT",
  "TARGET_UNSEEN",
  "PROMPT_NOT_OPEN",
  "REQUEST_NOT_OPEN",
  "SOLO_ONLY",
] as const;

export const IntentRefusalCodeSchema = z.enum([
  ...PARSE_AND_SCHEMA_CODES,
  ...GATE_AND_PLANNER_CODES,
]);
export type IntentRefusalCode = z.infer<typeof IntentRefusalCodeSchema>;

/** A Zod failure as a refusal: a tagged custom issue picks its code; otherwise `INTENT_SCHEMA`. */
export function schemaRefusalCode(
  issues: readonly { code: string; params?: Record<string, unknown> }[],
): IntentRefusalCode {
  for (const i of issues) {
    const tag = i.code === "custom" ? i.params?.refusal : undefined;
    if (tag === "MODEL_NUMBER" || tag === "INTENT_CHANNEL_MISMATCH") return tag;
  }
  return "INTENT_SCHEMA";
}
