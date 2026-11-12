import { parse } from "@the-stacks/intent";
import { useState } from "react";
import type { SuggestInput } from "../source.ts";

/**
 * The human DM's inline editor (FR-019): one `action.suggest` with one item. Plain wording is
 * an `attempt` for the line's character; wording starting `/` is parsed as that character.
 * `readSeq` is the `say` line's seq (spec OQ-4).
 */
export function ConfirmEditor({
  characterId,
  readSeq,
  initialText,
  onSuggest,
  onClose,
}: {
  characterId: string;
  readSeq: number;
  initialText: string;
  onSuggest: (input: SuggestInput) => boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);

  function send() {
    const wording = text.trim();
    if (wording === "") return;
    const suggestionId = `sug-${crypto.randomUUID()}`;
    const id = `${suggestionId}.i1`;
    const actor = { kind: "pc", id: characterId } as const;
    let intent: SuggestInput["items"][number]["intent"];
    if (wording.startsWith("/")) {
      const parsed = parse(wording, {
        id,
        actor,
        source: "composer",
        commit: "declared",
      });
      if (!parsed.ok) {
        setError(parsed.refusal.message);
        return;
      }
      intent = parsed.intent;
    } else {
      intent = {
        id,
        kind: "attempt",
        actor,
        targets: [],
        params: { scope: "character" },
        text: wording,
        source: "composer",
        commit: "declared",
      };
    }
    setError(null);
    if (
      onSuggest({
        suggestionId,
        readSeq,
        items: [{ itemId: "i1", text: wording, intent }],
      })
    ) {
      onClose();
    }
  }

  return (
    <form
      aria-label="Confirm as action"
      className="mt-1 flex flex-col gap-2 rounded-md border border-border p-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        aria-label="Action wording"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={text.trim() === ""}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Send to the table
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
