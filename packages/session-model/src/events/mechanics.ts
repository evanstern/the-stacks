import { EngineEventSchema } from "@the-stacks/dnd5e-engine";
import { z } from "zod";
import { RefIdSchema } from "../ids.js";

export const MechanicsEnvelopeV1 = z
  .object({
    batchId: RefIdSchema,
    index: z.number().int().min(0),
    count: z.number().int().min(1).max(500),
    actionId: RefIdSchema.nullable(),
    proposalId: RefIdSchema.nullable(),
    event: EngineEventSchema,
  })
  .refine((p) => p.index < p.count, {
    message: "index is below count",
    path: ["index"],
  });

export type MechanicsEnvelope = z.infer<typeof MechanicsEnvelopeV1>;
