import { useState } from "react";
import type { PendingProposalView } from "../proposals.ts";

const BUTTON =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent";

function ProposalRow({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: PendingProposalView;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string, reason: string | null) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <li className="rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium">{proposal.summary}</p>
      <p className="text-xs text-muted-foreground">
        {proposal.kind} · from {proposal.proposerLabel}
        {proposal.actionId ? ` · action ${proposal.actionId}` : ""}
      </p>
      <dl className="mt-2 space-y-0.5 text-sm">
        {proposal.details.map((d) => (
          <div key={d.label} className="flex gap-2">
            <dt className="text-muted-foreground">{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onApprove(proposal.proposalId)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setRejecting((was) => !was)}
          aria-expanded={rejecting}
          className={BUTTON}
        >
          Reject
        </button>
      </div>
      {rejecting && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for rejecting"
            placeholder="Reason (optional)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => onReject(proposal.proposalId, reason.trim() || null)}
            className={BUTTON}
          >
            Confirm reject
          </button>
        </div>
      )}
    </li>
  );
}

/** The DM's pending proposals; reject asks for an optional reason inline (no modal). */
export function ProposalList({
  proposals,
  onApprove,
  onReject,
}: {
  proposals: readonly PendingProposalView[];
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string, reason: string | null) => void;
}) {
  if (proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending proposals</p>
    );
  }
  return (
    <ul className="space-y-3">
      {proposals.map((p) => (
        <ProposalRow
          key={p.proposalId}
          proposal={p}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </ul>
  );
}
