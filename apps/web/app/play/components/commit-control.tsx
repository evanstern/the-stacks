import type { ActionAuthority } from "@the-stacks/session-model";
import type { ViewCommitAuthority } from "../view-model.ts";

export function commitLabel(authority: ActionAuthority): string {
  return authority === "dm" ? "Commit as DM" : "Commit";
}

/** A Commit button when the viewer holds commit authority, else who is awaited. */
export function CommitControl({
  commit,
  onCommit,
  commitsOnOwnTurn = false,
}: {
  commit: ViewCommitAuthority;
  onCommit: (authority: ActionAuthority) => void;
  /** The viewer's own action, waiting for their turn (spec 049, FR-003). */
  commitsOnOwnTurn?: boolean;
}) {
  if (commit.canCommit) {
    const { authority } = commit;
    return (
      <button
        type="button"
        onClick={() => onCommit(authority)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {commitLabel(authority)}
      </button>
    );
  }
  if (commitsOnOwnTurn) {
    return (
      <p className="text-sm text-muted-foreground">Commits on your turn</p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {commit.holderLabel
        ? `Waiting for ${commit.holderLabel} to commit`
        : "Waiting for a commit"}
    </p>
  );
}
