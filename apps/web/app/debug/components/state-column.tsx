import type { SessionProjections } from "@the-stacks/session-model";
import { actorLabel } from "../../play/labels.ts";

export type PanelName = "seed" | "ledger" | "journal" | "cost";

const PANELS: { name: PanelName; label: string }[] = [
  { name: "seed", label: "Seed" },
  { name: "ledger", label: "Ledger" },
  { name: "journal", label: "Journal" },
  { name: "cost", label: "Cost" },
];

const H = "mt-3 mb-1 text-xs font-semibold uppercase text-muted-foreground";

/**
 * The right column (FR-039..FR-042): the DM projection, live or folded through
 * `pinnedSeq`. Pure over its props; the board owns the fold and the selection.
 */
export function StateColumn({
  projection,
  pinnedSeq,
  onBackToLive,
  onOpenPanel,
}: {
  projection: SessionProjections;
  pinnedSeq: number | null;
  onBackToLive: () => void;
  onOpenPanel: (name: PanelName) => void;
}) {
  const p = projection;
  const name = (actor: string) => actorLabel(actor, p.party, "");
  const pending = p.proposals.filter((x) => x.status === "pending");
  const active = p.encounter?.order.find(
    (o) => o.combatantId === p.encounter?.activeCombatantId,
  );
  const overrides = Object.entries(p.gate.policyOverrides);
  return (
    <div className="flex flex-col text-sm text-foreground">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">State</h2>
        {pinnedSeq !== null ? (
          <>
            <span
              data-testid="pin-badge"
              className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
            >
              pinned at seq {pinnedSeq}
            </span>
            <button
              type="button"
              onClick={onBackToLive}
              className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
            >
              back to live
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            live through seq {p.throughSeq}
          </span>
        )}
        <span className="flex w-full flex-wrap gap-1.5">
          {PANELS.map((x) => (
            <button
              key={x.name}
              type="button"
              onClick={() => onOpenPanel(x.name)}
              className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
            >
              {x.label}
            </button>
          ))}
        </span>
      </header>

      <h3 className={H}>Table</h3>
      <p>
        Mode:{" "}
        {p.tableMode.mode === "turn"
          ? `turn, ${name(p.tableMode.activeActor)}`
          : "free"}
      </p>
      <p>
        DM seat:{" "}
        {p.gate.seat.kind === "ai" ? "AI" : `human (${p.gate.seat.userId})`}
      </p>
      <p>
        Gate policy overrides:{" "}
        {overrides.length === 0
          ? "none"
          : overrides.map(([k, v]) => `${k}: ${v}`).join(", ")}
      </p>
      <p>Scene: {p.scene ? p.scene.title : "none"}</p>

      <h3 className={H}>Party</h3>
      {p.party.length === 0 ? (
        <p className="text-muted-foreground">No characters.</p>
      ) : (
        <ul className="space-y-1">
          {p.party.map((m) => (
            <li key={m.characterId}>
              <span className="font-medium">{m.name}</span>
              {m.combatant
                ? ` HP ${m.combatant.hp.current}/${m.combatant.hp.max}${
                    m.combatant.hp.temp > 0 ? ` +${m.combatant.hp.temp}` : ""
                  }, ${m.combatant.lifeState}${
                    m.combatant.conditions.length > 0
                      ? `, ${m.combatant.conditions.map((c) => c.condition).join(", ")}`
                      : ""
                  }`
                : " no combatant"}
            </li>
          ))}
        </ul>
      )}

      <h3 className={H}>Encounter</h3>
      {p.encounter === null ? (
        <p className="text-muted-foreground">No encounter.</p>
      ) : (
        <>
          <p>
            Round {p.encounter.round}, active{" "}
            {active?.name ?? p.encounter.activeCombatantId}
          </p>
          <ol className="space-y-0.5">
            {p.encounter.order.map((o) => (
              <li key={o.combatantId}>
                {o.name} (init {o.initiative}) HP {o.hp.current}/{o.hp.max},{" "}
                {o.lifeState}
              </li>
            ))}
          </ol>
        </>
      )}

      <h3 className={H}>Trackers</h3>
      {p.trackers.length === 0 ? (
        <p className="text-muted-foreground">No trackers.</p>
      ) : (
        <ul className="space-y-0.5">
          {p.trackers.map((t) => (
            <li key={t.trackerId}>
              {t.name} {t.filled}/{t.segments}
              {t.note ? ` (${t.note})` : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 className={H}>Pending proposals</h3>
      {pending.length === 0 ? (
        <p className="text-muted-foreground">No pending proposals.</p>
      ) : (
        <ul className="space-y-0.5">
          {pending.map((x) => (
            <li key={x.proposalId}>
              {x.kind} ({x.policy}) from {name(x.proposer)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
