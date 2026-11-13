import { useState } from "react";
import { narrationRows } from "../narration-rows.ts";
import type { TableCommands } from "../source.ts";
import type { StreamItem } from "../stream.ts";
import { ActionCard } from "./action-card.tsx";
import { ConfirmEditor } from "./confirm-editor.tsx";
import { ConfirmRow } from "./confirm-row.tsx";
import { RollRow } from "./roll-row.tsx";
import { RoomBlock } from "./room-block.tsx";

function Narration({ text }: { text: string }) {
  const { prose, rules } = narrationRows(text);
  return (
    <div className="flex flex-col gap-1 break-words">
      {prose.map((seg) =>
        seg.kind === "dialogue" ? (
          <p
            key={seg.text}
            data-kind="dialogue"
            className="whitespace-pre-line text-foreground"
          >
            {seg.text}
          </p>
        ) : (
          <p
            key={seg.text}
            className="whitespace-pre-line italic text-muted-foreground"
          >
            {seg.text}
          </p>
        ),
      )}
      {rules.map((line) => (
        <p
          key={line}
          data-kind="rules"
          className="text-sm text-muted-foreground"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export type TranscriptCommands = Pick<
  TableCommands,
  "commit" | "withdraw" | "accept" | "suggest" | "sendIntent"
>;

export function Transcript({
  items,
  commands,
  onNotQuite,
}: {
  items: readonly StreamItem[];
  commands: TranscriptCommands;
  /** Not quite: move focus to the composer (FR-017). */
  onNotQuite: () => void;
}) {
  // The seq of the `say` line whose inline editor is open (one at a time).
  const [editing, setEditing] = useState<number | null>(null);
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing said yet.</p>;
  }
  return (
    <ol
      role="log"
      aria-live="polite"
      aria-label="Table stream"
      className="flex flex-col gap-3"
    >
      {items.map((entry) => {
        const item = entry.kind === "transcript" ? entry.item : null;
        return (
          <li key={`${entry.kind}-${entry.seq}`}>
            {entry.kind === "roll" ? (
              <RollRow roll={entry} />
            ) : entry.kind === "room" ? (
              <RoomBlock room={entry} />
            ) : entry.kind === "rules" ? (
              <p data-kind="rules" className="text-sm text-muted-foreground">
                {entry.text}
              </p>
            ) : !item ? null : item.kind === "talk" ? (
              <div>
                <p
                  data-kind={
                    item.channel === "ic" && !item.askDm
                      ? "dialogue"
                      : undefined
                  }
                  data-ask-dm={item.askDm ? "true" : undefined}
                  className={
                    item.askDm ? "rounded-md bg-accent px-2 py-1" : undefined
                  }
                >
                  <strong>{item.characterLabel ?? item.actorLabel}</strong>{" "}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {item.askDm
                      ? "Asks the DM"
                      : item.channel === "ic"
                        ? "IC"
                        : "Table talk"}
                  </span>
                  {item.whisper && (
                    <span className="ml-1 rounded-full bg-proc-surface px-2 py-0.5 text-xs text-proc">
                      Whisper
                    </span>
                  )}{" "}
                  {item.text}
                </p>
                {item.confirmable && item.characterId && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing(editing === item.seq ? null : item.seq)
                      }
                      className="mt-1 rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
                    >
                      Confirm as action…
                    </button>
                    {editing === item.seq && (
                      <ConfirmEditor
                        characterId={item.characterId}
                        readSeq={item.seq}
                        initialText={item.text}
                        onSuggest={commands.suggest}
                        onClose={() => setEditing(null)}
                      />
                    )}
                  </>
                )}
              </div>
            ) : item.kind === "aside" ? (
              <p
                data-kind="aside"
                className="rounded-md border-l-2 border-border pl-3 text-sm text-muted-foreground"
              >
                <strong>DM aside</strong> {item.text}
              </p>
            ) : item.kind === "confirm" ? (
              <ConfirmRow
                confirm={item.confirm}
                onAccept={commands.accept}
                onNotQuite={onNotQuite}
              />
            ) : item.kind === "intent" ? (
              <p className="text-sm">
                <strong>{item.actorLabel}</strong> {item.text}
                {item.declaredIntent && (
                  <button
                    type="button"
                    onClick={() =>
                      item.declaredIntent &&
                      commands.sendIntent({
                        ...item.declaredIntent,
                        commit: "confirmed",
                      })
                    }
                    className="ml-2 rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
                  >
                    Confirm
                  </button>
                )}
              </p>
            ) : item.kind === "floor" ? (
              <p
                data-kind="floor"
                className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {item.text}
              </p>
            ) : item.kind === "narration-stream" ? (
              <div
                data-kind="narration-stream"
                aria-busy="true"
                className="break-words italic text-muted-foreground"
              >
                <p className="text-xs font-medium uppercase tracking-wide">
                  The DM is narrating
                </p>
                {item.rows && (
                  <div className="not-italic">
                    <Narration text={item.rows} />
                  </div>
                )}
                {item.prose && (
                  <p className="whitespace-pre-line">{item.prose}</p>
                )}
              </div>
            ) : item.kind === "narration" ? (
              <Narration text={item.text} />
            ) : (
              <ActionCard
                card={item.card}
                onCommit={commands.commit}
                onWithdraw={commands.withdraw}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
