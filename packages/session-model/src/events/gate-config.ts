import { z } from "zod";
import { PolicySchema } from "../gate/policy.js";
import { DmProposalKindSchema } from "../gate/proposals.js";
import { DmSeatSchema } from "../gate/seat.js";
import { ReasonSchema } from "../ids.js";

export const DmSeatChangedV1 = z.object({
  reason: ReasonSchema,
  before: DmSeatSchema,
  after: DmSeatSchema,
});

export const GatePolicyChangedV1 = z.object({
  reason: ReasonSchema,
  proposalKind: DmProposalKindSchema,
  before: PolicySchema,
  after: PolicySchema,
});
