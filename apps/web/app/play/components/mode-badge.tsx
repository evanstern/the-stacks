import type { ModeView } from "../view-model.ts";

/** "Free mode" / "Turn mode · Ana's turn" / "Turn mode · Your turn" (AC #3). */
export function ModeBadge({ mode }: { mode: ModeView }) {
  const text =
    mode.mode === "free"
      ? "Free mode"
      : `Turn mode · ${mode.isViewersTurn ? "Your turn" : `${mode.activeLabel}'s turn`}`;
  return (
    <span
      data-mode={mode.mode}
      className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium"
    >
      {text}
    </span>
  );
}
