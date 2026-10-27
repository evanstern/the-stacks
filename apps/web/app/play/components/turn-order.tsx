import type { OrderEntry } from "../view-model.ts";

/**
 * The turn-order strip under the header (specs/049-turn-floor/contracts/ui-floor.md): one entry
 * per combatant in order, the active one marked, the next one flagged "next", the viewer's own
 * flagged "you". It wraps at phone width.
 */
export function TurnOrder({ order }: { order: readonly OrderEntry[] }) {
  if (order.length === 0) return null;
  return (
    <ol
      aria-label="Turn order"
      className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2 text-sm"
    >
      {order.map((entry) => (
        <li
          key={entry.combatantId}
          data-active={entry.isActive}
          aria-current={entry.isActive ? "step" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${
            entry.isActive
              ? "border-primary bg-primary text-primary-foreground font-medium"
              : "border-border bg-secondary"
          }`}
        >
          <span>{entry.label}</span>
          {entry.isNext && <span className="text-xs opacity-80">next</span>}
          {entry.isViewer && <span className="text-xs opacity-80">you</span>}
        </li>
      ))}
    </ol>
  );
}
