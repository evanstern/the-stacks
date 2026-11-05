import type { PartyRow } from "../party.ts";
import type { ModeView } from "../view-model.ts";

/** The 390 px stand-in for the margin (plan D4): other members' HP and the first three in order. */
export function MiniStrip({
  party,
  mode,
}: {
  party: readonly PartyRow[];
  mode: ModeView;
}) {
  const others = party
    .filter((r) => !r.isOwn)
    .map((r) => `${r.name} ${r.hp ? `${r.hp.current}/${r.hp.max}` : "—"}`);
  const order =
    mode.mode === "turn" && mode.order.length > 0
      ? `Order: ${mode.order
          .slice(0, 3)
          .map((o) => o.label)
          .join(" › ")}${mode.order.length > 3 ? "…" : ""}`
      : null;
  const parts = [...(others.length > 0 ? [others.join(" · ")] : []), order];
  const text = parts.filter(Boolean).join(" · ");
  if (text === "") return null;
  return (
    <p
      data-strip="mini"
      className="hidden border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground narrow:block"
    >
      {text}
    </p>
  );
}
