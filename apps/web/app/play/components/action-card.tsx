import { useState } from "react";
import type { CommentInput, CommitInput, WithdrawInput } from "../source.ts";
import type { ActionCardView } from "../view-model.ts";
import { CommitControl } from "./commit-control.tsx";

const STANCES: { stance: CommentInput["stance"]; label: string }[] = [
  { stance: "comment", label: "Comment" },
  { stance: "approve", label: "Approve" },
  { stance: "object", label: "Object" },
];

const STATUS_LABEL: Record<ActionCardView["status"], string> = {
  declared: "Declared",
  discussed: "Discussed",
  committed: "Committed",
  resolved: "Resolved",
  withdrawn: "Withdrawn",
};

function CommentForm({
  actionId,
  onComment,
}: {
  actionId: string;
  onComment: (input: CommentInput) => boolean;
}) {
  const [text, setText] = useState("");
  function send(stance: CommentInput["stance"]) {
    if (onComment({ actionId, stance, text })) setText("");
  }
  const empty = text.trim().length === 0;
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) send("comment");
      }}
    >
      <input
        aria-label="Comment on this action"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comment on this action"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
      />
      <div className="flex flex-wrap gap-2">
        {STANCES.map(({ stance, label }) => (
          <button
            key={stance}
            type="button"
            disabled={empty}
            onClick={() => send(stance)}
            className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}

export function ActionCard({
  card,
  onComment,
  onCommit,
  onWithdraw,
}: {
  card: ActionCardView;
  onComment: (input: CommentInput) => boolean;
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

      {card.comments.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3 text-sm">
          {card.comments.map((c) => (
            <li key={c.seq}>
              <strong>{c.actorLabel}</strong>{" "}
              <span className="text-muted-foreground">
                {c.stance === "comment" ? "commented" : `${c.stance}d`}
              </span>
              {c.text ? `: ${c.text}` : null}
            </li>
          ))}
        </ul>
      )}

      {card.open && (
        <div className="mt-2">
          <CommitControl
            commit={card.commit}
            onCommit={(authority) =>
              onCommit({ actionId: card.actionId, authority })
            }
          />
          <CommentForm actionId={card.actionId} onComment={onComment} />
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
