import type { FloorInput } from "../source.ts";
import type { FloorControls as FloorControlsView } from "../view-model.ts";

const BUTTON =
  "rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent";
const PRIMARY =
  "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90";

/**
 * The floor buttons in the table header (specs/049-turn-floor/contracts/ui-floor.md): End turn
 * for the active player; Pass, Take floor and Return floor for the seated DM. Each click sends
 * one `floor` request with the turn the viewer saw. Nothing asks for confirmation.
 */
export function FloorControls({
  controls,
  onFloor,
}: {
  controls: FloorControlsView;
  onFloor: (input: FloorInput) => boolean;
}) {
  const { turn } = controls;
  if (!turn) return null;
  if (
    !(controls.endTurn || controls.pass || controls.take || controls.return)
  ) {
    return null;
  }
  const send = (op: FloorInput["op"]) => () => {
    onFloor({ op, turn });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {controls.endTurn && (
        <button type="button" onClick={send("end")} className={PRIMARY}>
          End turn
        </button>
      )}
      {controls.pass && (
        <button type="button" onClick={send("end")} className={BUTTON}>
          Pass
        </button>
      )}
      {controls.take && (
        <button type="button" onClick={send("take")} className={BUTTON}>
          Take floor
        </button>
      )}
      {controls.return && (
        <button type="button" onClick={send("return")} className={PRIMARY}>
          Return floor
        </button>
      )}
    </div>
  );
}
