import { useState } from "react";
import { Label } from "~/components/ui/label";
import { tableModeReason } from "../frames.ts";
import type { EncounterEndInput, TableModeInput } from "../source.ts";
import type { TableModeView } from "../table-mode.ts";

export const TABLE_MODE_PANEL_ID = "table-mode-panel";

const BUTTON =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent";
const FIELD =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

/** The End encounter request. In turn mode the free-mode follow-up is sent too (OQ-2). */
export function endInput(
  view: TableModeView,
  reason: string,
): EncounterEndInput {
  return { reason: reason.trim(), thenFree: view.mode === "turn" };
}

/** A table-mode request. Turn mode uses the view's `turnAfter`; free needs none. */
export function modeInput(
  view: TableModeView,
  target: "free" | "turn",
  reason: string,
): TableModeInput | null {
  const sent = reason.trim() || tableModeReason(target);
  if (target === "free") return { reason: sent, after: { mode: "free" } };
  return view.turnAfter ? { reason: sent, after: view.turnAfter } : null;
}

/** The human DM's Table mode body. Renders inside the shared slide-out `Panel`. */
export function TableModePanel({
  view,
  onEndEncounter,
  onSetMode,
}: {
  view: TableModeView;
  onEndEncounter: (input: EncounterEndInput) => boolean;
  onSetMode: (input: TableModeInput) => boolean;
}) {
  const [reason, setReason] = useState("");
  const done = (ok: boolean) => {
    if (ok) setReason("");
  };
  const nothing = !view.canEnd && !view.canFree && view.turnAfter === null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {view.mode === "turn" ? "Turn mode" : "Free mode"}.{" "}
        {view.encounterActive ? "Encounter active." : "No encounter."}
      </p>
      {nothing && (
        <p className="text-sm text-muted-foreground">
          Turn mode needs an encounter. The AI DM starts one.
        </p>
      )}
      {!nothing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="table-mode-reason">Reason (optional)</Label>
          <textarea
            id="table-mode-reason"
            rows={2}
            className={FIELD}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-3">
        {view.canEnd && (
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() => done(onEndEncounter(endInput(view, reason)))}
          >
            End encounter
          </button>
        )}
        {view.canFree && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className={`${BUTTON} self-start`}
              onClick={() => {
                const input = modeInput(view, "free", reason);
                if (input) done(onSetMode(input));
              }}
            >
              Switch to free mode
            </button>
            {view.encounterActive && (
              <p className="text-xs text-muted-foreground">
                The encounter stays active.
              </p>
            )}
          </div>
        )}
        {view.turnAfter !== null && (
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() => {
              const input = modeInput(view, "turn", reason);
              if (input) done(onSetMode(input));
            }}
          >
            Switch to turn mode
          </button>
        )}
      </div>
    </div>
  );
}
