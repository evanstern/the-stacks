import type { TableCommands } from "../source.ts";
import type { TranscriptItem } from "../view-model.ts";
import { ActionCard } from "./action-card.tsx";

export function Transcript({
  items,
  commands,
}: {
  items: readonly TranscriptItem[];
  commands: Pick<TableCommands, "comment" | "commit" | "withdraw">;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing said yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={`${item.kind}-${item.seq}`}>
          {item.kind === "talk" ? (
            <p>
              <strong>{item.characterLabel ?? item.actorLabel}</strong>{" "}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {item.channel === "ic" ? "IC" : "OOC"}
              </span>
              {item.whisper && (
                <span className="ml-1 rounded-full bg-proc-surface px-2 py-0.5 text-xs text-proc">
                  Whisper
                </span>
              )}{" "}
              {item.text}
            </p>
          ) : item.kind === "floor" ? (
            <p
              data-kind="floor"
              className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {item.text}
            </p>
          ) : item.kind === "narration" ? (
            <p className="italic text-muted-foreground">{item.text}</p>
          ) : (
            <ActionCard
              card={item.card}
              onComment={commands.comment}
              onCommit={commands.commit}
              onWithdraw={commands.withdraw}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
