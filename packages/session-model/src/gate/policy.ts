import { z } from "zod";
import type { GateView, SessionProjections } from "../projections/types.js";
import type { DmProposalKind, Proposal, Proposer } from "./proposals.js";
import { isAiDm } from "./roles.js";

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
  "scene-presence": "ask",
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

export type Route =
  | { route: "direct" }
  | { route: "policy"; policy: Policy }
  | { route: "refuse"; code: "NOT_AUTHORIZED" };

/**
 * Humans and AI companions route `direct` (the permission matrix runs first).
 * `ai:dm` routes by its effective policy; it never declares actions.
 */
export function routeProposal(
  p: SessionProjections,
  proposer: Proposer,
  proposal: Proposal,
): Route {
  if (!isAiDm(proposer)) return { route: "direct" };
  if (
    proposal.kind === "action.declare" ||
    proposal.kind === "action.withdraw"
  ) {
    return { route: "refuse", code: "NOT_AUTHORIZED" };
  }
  return { route: "policy", policy: effectivePolicy(p.gate, proposal.kind) };
}
