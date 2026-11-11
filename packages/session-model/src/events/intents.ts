import { INTENT_SCHEMA_VERSION, IntentSchema } from "@the-stacks/intent";
import { PlanFactSchema, RulingRequestSchema } from "@the-stacks/planner";
import { z } from "zod";
import { RefIdSchema } from "../ids.js";

/** The carrier row of one accepted Intent (specs/102-gate-intents plan, "Data model"). */
export const IntentRecordedV1 = z.object({
  intent: IntentSchema,
  /** The intent contract's schema major (contract §10). */
  schemaVersion: z.literal(INTENT_SCHEMA_VERSION),
  outcome: z.enum(["declared", "settled", "needs_ruling"]),
  /** The engine batch the Intent produced, else null. */
  batchId: RefIdSchema.nullable(),
  /** The planner's facts; [] for gate-handled kinds. */
  facts: z.array(PlanFactSchema),
  /** Set only when `outcome` is `needs_ruling`. */
  request: RulingRequestSchema.nullable(),
  /** The request id a `ruling` or `set_dc` Intent closed. */
  answers: RefIdSchema.nullable(),
  /** A later command refused (planner contract §3 rule 4); earlier events stand. */
  stopped: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type IntentRecorded = z.infer<typeof IntentRecordedV1>;
