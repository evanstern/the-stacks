import type { CommitInput, WithdrawInput } from "../source.ts";
import type { ActionCardView } from "../view-model.ts";
import { CommitControl } from "./commit-control.tsx";

const STATUS_LABEL: Record<ActionCardView["status"], string> = {
  declared: "Declared",
  discussed: "Discussed",
  committed: "Committed",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

export function ActionCard({
  card,
  onCommit,
  onWithdraw,
}: {
  card: ActionCardView;
  onCommit: (input: CommitInput) => boolean;
  onWithdraw: (input: WithdrawInput) => boolean;
}) {
  return (
    <article
      aria-label={`Action by ${card.actorLabel}`}
      className="rounded-lg border border-border bg-card p-3"
    >
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <strong>{card.characterLabel ?? card.actorLabel}</strong>
        <span className="text-muted-foreground">
          {card.scope === "party" ? "Whole party" : `by ${card.actorLabel}`}
        </span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
          {STATUS_LABEL[card.status]}
        </span>
      </header>
      <p className="mt-1">{card.text}</p>

      {card.open && (
        <div className="mt-2">
          <CommitControl
            commit={card.commit}
            onCommit={(authority) =>
              onCommit({ actionId: card.actionId, authority })
            }
          />
          {card.canWithdraw && (
            <button
              type="button"
              onClick={() => onWithdraw({ actionId: card.actionId })}
              className="mt-2 rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
            >
              Withdraw
            </button>
          )}
        </div>
      )}

      {card.status === "withdrawn" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Withdrawn. This action is closed.
        </p>
      )}

      {card.committed && !card.resolved && (
        <p className="mt-2 text-sm text-muted-foreground">
          Committed by {card.committed.actorLabel}
        </p>
      )}
      {card.resolved && (
        <p className="mt-2 text-sm">
          {card.committed ? `Committed by ${card.committed.actorLabel}. ` : ""}
          Outcome: {card.resolved.outcome}
          {card.resolved.refusalCode ? ` (${card.resolved.refusalCode})` : ""}
        </p>
      )}
    </article>
  );
}
