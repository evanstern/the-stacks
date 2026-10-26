import type { StoredEvent, Viewer } from "@the-stacks/session-model";

export interface PendingProposalView {
  proposalId: string;
  /** The proposal kind as the gate names it (for example "narration", "damage.apply"). */
  kind: string;
  /** One line the DM reads first: what approving would do. */
  summary: string;
  /** The proposing actor id ("ai:dm", "ai:companion:<id>", or a user id). */
  proposer: string;
  /** Display name for the proposer, resolved from the party where possible. */
  proposerLabel: string;
  /** The player action this proposal serves, when any. */
  actionId: string | null;
  /** Ordered label/value rows rendered under the summary. Values are display strings. */
  details: readonly { label: string; value: string }[];
  /** The seq of the event that raised it; the list is ordered by this, oldest first. */
  createdSeq: number;
  ts: string;
}

export interface ProposalCommands {
  /** Returns true when the decision left (live) or applied (fixture). */
  approve(proposalId: string): boolean;
  reject(proposalId: string, reason: string | null): boolean;
}

/** Pending proposals visible to `viewer`, oldest first. Always [] for a player viewer. */
export type SelectPendingProposals = (
  events: readonly StoredEvent[],
  viewer: Viewer,
) => PendingProposalView[];

/**
 * Before TASK-0045 merges no proposal event type exists, so the live table has none.
 * Phase 6 replaces this with a real selector.
 */
export const liveProposals: SelectPendingProposals = () => [];
