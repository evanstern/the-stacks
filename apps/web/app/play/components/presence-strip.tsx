import type { PresenceRow } from "../presence.ts";

const ROLE_TEXT: Record<PresenceRow["role"], string> = {
  dm: "DM",
  player: "Player",
  observer: "Observer",
};

/** Who is at the table: one chip per user, marked DM, player or observer, absent dimmed. */
export function PresenceStrip({ rows }: { rows: readonly PresenceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul
      aria-label="At the table"
      className="flex flex-wrap items-center gap-1.5"
    >
      {rows.map((row) => (
        <li
          key={row.key}
          data-presence={row.present ? "present" : "absent"}
          className={
            row.present
              ? "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs"
              : "inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          <span
            aria-hidden="true"
            className={
              row.present
                ? "size-1.5 rounded-full bg-green-600"
                : "size-1.5 rounded-full bg-muted-foreground/50"
            }
          />
          <span className="font-medium">{row.label}</span>
          <span className="text-muted-foreground">
            {ROLE_TEXT[row.role]}
            {row.present ? "" : " · absent"}
          </span>
        </li>
      ))}
    </ul>
  );
}
