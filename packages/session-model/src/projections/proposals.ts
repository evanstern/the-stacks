import type { SessionNativeEvent } from "../catalog.js";
import type { ProposalView, SessionProjections } from "./types.js";

type CreatedEvent = Extract<SessionNativeEvent, { type: "proposal.created" }>;
type ApprovedEvent = Extract<SessionNativeEvent, { type: "proposal.approved" }>;
type RejectedEvent = Extract<SessionNativeEvent, { type: "proposal.rejected" }>;

export interface ProposalsResult {
  proposals: ProposalView[];
  ignored: boolean;
}

export function createProposal(
  proposals: ProposalView[],
  event: CreatedEvent,
): ProposalsResult {
  const { proposalId, policy, proposal } = event.payload;
  if (proposals.some((p) => p.proposalId === proposalId)) {
    return { proposals, ignored: true };
  }
  const view: ProposalView = {
    proposalId,
    createdSeq: event.seq,
    ts: event.ts,
    proposer: event.actor,
    policy,
    kind: proposal.kind,
    proposal,
    status: "pending",
    decided: null,
  };
  return { proposals: [...proposals, view], ignored: false };
}

export function approveProposal(
  proposals: ProposalView[],
  event: ApprovedEvent,
): ProposalsResult {
  const target = proposals.find(
    (p) => p.proposalId === event.payload.proposalId,
  );
  if (target?.status !== "pending" || target.policy === "suggest") {
    return { proposals, ignored: true };
  }
  return {
    proposals: proposals.map((p) =>
      p === target
        ? {
            ...p,
            status: "approved" as const,
            decided: {
              seq: event.seq,
              actor: event.actor,
              batchId: event.payload.batchId,
              reason: null,
            },
          }
        : p,
    ),
    ignored: false,
  };
}

export function rejectProposal(
  proposals: ProposalView[],
  event: RejectedEvent,
): ProposalsResult {
  const target = proposals.find(
    (p) => p.proposalId === event.payload.proposalId,
  );
  if (target?.status !== "pending") {
    return { proposals, ignored: true };
  }
  return {
    proposals: proposals.map((p) =>
      p === target
        ? {
            ...p,
            status: "rejected" as const,
            decided: {
              seq: event.seq,
              actor: event.actor,
              batchId: null,
              reason: event.payload.reason,
            },
          }
        : p,
    ),
    ignored: false,
  };
}

/** Proposals still awaiting a decision, in log order. */
export function pendingProposals(p: SessionProjections): ProposalView[] {
  return p.proposals.filter((view) => view.status === "pending");
}

export function findProposal(
  p: SessionProjections,
  proposalId: string,
): ProposalView | undefined {
  return p.proposals.find((view) => view.proposalId === proposalId);
}
