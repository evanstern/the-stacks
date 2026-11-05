import { conditionText } from "../conditions.ts";
import type { PartyRow } from "../party.ts";
import type { ModeView } from "../view-model.ts";

/** One line above the composer: the viewer's character and whose turn it is (FR-003). */
export function StatusStrip({
  own,
  conditions,
  mode,
}: {
  own: PartyRow | null;
  conditions: readonly { condition: string }[];
  mode: ModeView;
}) {
  const turn =
    mode.mode === "turn"
      ? `Turn: ${mode.activeLabel}${mode.isViewersTurn ? " (you)" : ""}`
      : "Turn: free play";
  const parts = own
    ? [
        own.name,
        own.hp ? `HP ${own.hp.current}/${own.hp.max}` : "HP —",
        own.ac !== null ? `AC ${own.ac}` : "AC —",
        `Conditions: ${conditionText(conditions)}`,
        turn,
      ]
    : [turn];
  return (
    <p
      data-strip="status"
      className="border-t border-border bg-card px-3 py-1 text-xs"
    >
      {parts.join(" · ")}
    </p>
  );
}
