import type { PartyRow } from "../party.ts";
import type { OrderEntry } from "../view-model.ts";
import { TurnOrder } from "./turn-order.tsx";

export const PARTY_PANEL_ID = "party-panel";

function vitals(row: PartyRow): string {
  const hp = row.hp
    ? `HP ${row.hp.current}/${row.hp.max}${row.hp.temp > 0 ? ` (+${row.hp.temp})` : ""}`
    : "HP —";
  const ac = row.ac !== null ? `AC ${row.ac}` : "AC —";
  return `${row.classLevel ?? "Class and level not recorded"} · ${hp} · ${ac}`;
}

/** The Party slide-out body: each character, who controls it, vitals, and the initiative order. */
export function PartyPanel({
  rows,
  order,
}: {
  rows: readonly PartyRow[];
  order: readonly OrderEntry[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No party yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Party" className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.characterId}
            data-own={row.isOwn || undefined}
            className="rounded-md border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{row.name}</span>
              {row.isOwn && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  Your character
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {row.controller}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{vitals(row)}</p>
          </li>
        ))}
      </ul>
      {order.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Initiative</h3>
          <TurnOrder order={order} label="Initiative" />
        </section>
      )}
    </div>
  );
}
