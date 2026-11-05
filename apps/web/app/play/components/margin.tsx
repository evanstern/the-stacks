import { type PartyRow, vitals } from "../party.ts";
import type { ModeView } from "../view-model.ts";
import { TurnOrder } from "./turn-order.tsx";

export interface ConditionLine {
  name: string;
  text: string;
}

/**
 * The right margin (specs/090-table-margin, plan D4): party vitals, turn order and conditions.
 * Hidden at `narrow:`, where the mini-strip carries the same facts. Holds no state.
 */
export function Margin({
  party,
  mode,
  conditions,
}: {
  party: readonly PartyRow[];
  mode: ModeView;
  /** Combatants that carry at least one condition. */
  conditions: readonly ConditionLine[];
}) {
  return (
    <aside
      aria-label="Table state"
      className="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-card p-3 text-sm narrow:hidden"
    >
      <section>
        <h3 className="mb-1 font-semibold">Party</h3>
        {party.length === 0 ? (
          <p className="text-muted-foreground">No party yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {party.map((row) => (
              <li key={row.characterId}>
                <span className="font-medium">{row.name}</span>
                <p className="text-xs text-muted-foreground">{vitals(row)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        {mode.mode === "turn" && mode.order.length > 0 ? (
          <>
            <h3 className="mb-1 font-semibold">Turn order</h3>
            <TurnOrder order={mode.order} label="Turn order" />
          </>
        ) : (
          <p className="text-muted-foreground">Not in combat.</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Conditions</h3>
        {conditions.length === 0 ? (
          <p className="text-muted-foreground">Conditions: none.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conditions.map((c) => (
              <li key={c.name} className="text-muted-foreground">
                {c.name}: {c.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
