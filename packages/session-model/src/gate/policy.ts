import { z } from "zod";
import type { GateView } from "../projections/types.js";
import type { DmProposalKind } from "./proposals.js";

export const PolicySchema = z.enum(["auto", "ask", "suggest"]);

export type Policy = z.infer<typeof PolicySchema>;
export type PolicyTable = Readonly<Record<DmProposalKind, Policy>>;

/** The default policy for each kind the AI DM may propose (AC #2). */
export const DEFAULT_POLICIES: PolicyTable = {
  talk: "ask",
  "action.comment": "ask",
  "action.commit": "ask",
  "action.resolve": "auto",
  mechanics: "ask",
  narration: "ask",
  "table-mode": "ask",
  scene: "suggest",
  party: "ask",
  tracker: "ask",
  journal: "auto",
};

/**
 * AI seat: always "auto" (no human DM can be asked).
 * Human seat: the session's override for the kind, else DEFAULT_POLICIES.
 */
export function effectivePolicy(gate: GateView, kind: DmProposalKind): Policy {
  if (gate.seat.kind === "ai") return "auto";
  return gate.policyOverrides[kind] ?? DEFAULT_POLICIES[kind];
}
