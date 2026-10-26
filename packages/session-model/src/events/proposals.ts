import { z } from "zod";
import { ProposalSchema } from "../gate/proposals.js";
import { RefIdSchema } from "../ids.js";

export const ProposalCreatedV1 = z.object({
  proposalId: RefIdSchema,
  policy: z.enum(["ask", "suggest"]),
  proposal: ProposalSchema,
});

export const ProposalApprovedV1 = z.object({
  proposalId: RefIdSchema,
  batchId: RefIdSchema.nullable(),
});

export const ProposalRejectedV1 = z.object({
  proposalId: RefIdSchema,
  reason: z.string().min(1).max(500).nullable(),
});
