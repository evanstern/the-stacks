import type { ConfirmView } from "../view-model.ts";

/** One DM confirm row (FR-015, FR-017, FR-018). State is a word, never colour alone. */
export function ConfirmRow({
  confirm,
  onAccept,
  onNotQuite,
}: {
  confirm: ConfirmView;
  onAccept: (input: { suggestionId: string; itemId: string }) => boolean;
  onNotQuite: () => void;
}) {
  return (
    <section
      aria-label="DM confirm"
      className="rounded-lg border border-dashed border-border bg-card p-3 text-sm"
    >
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        The DM asks
      </h4>
      <ul className="mt-1 flex flex-col gap-2">
        {confirm.lines.map((line) => (
          <li
            key={line.itemId}
            data-state={line.state}
            className="flex flex-wrap items-center gap-2"
          >
            <span>
              {line.text}{" "}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {line.kindLabel}
              </span>
            </span>
            {line.state === "confirmed" && (
              <span className="font-medium">Confirmed</span>
            )}
            {line.state === "stale" && (
              <span className="text-muted-foreground">Superseded</span>
            )}
            {line.state === "live" && line.canAccept && (
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onAccept({
                      suggestionId: confirm.suggestionId,
                      itemId: line.itemId,
                    })
                  }
                  className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  👍 Yes
                </button>
                <button
                  type="button"
                  onClick={onNotQuite}
                  className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent"
                >
                  Not quite
                </button>
              </span>
            )}
            {line.state === "live" && !line.canAccept && line.waitingOn && (
              <span className="text-muted-foreground">
                Waiting on {line.waitingOn}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
