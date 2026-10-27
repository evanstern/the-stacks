import { Panel } from "~/components/panel";
import type { CallTotals, UsageTotals } from "../api-types.ts";

const usd = (n: number) => `$${n.toFixed(4)}`;

function Row({ label, t }: { label: string; t: UsageTotals }) {
  return (
    <tr className="border-t border-border">
      <td className="py-1 pr-2 font-mono text-xs">{label}</td>
      <td className="pr-2 text-right">{t.calls}</td>
      <td className="pr-2 text-right">{t.inputTokens}</td>
      <td className="pr-2 text-right">{t.outputTokens}</td>
      <td className="text-right">{usd(t.costUsd)}</td>
    </tr>
  );
}

function Table({
  title,
  rows,
}: {
  title: string;
  rows: [string, UsageTotals][];
}) {
  return (
    <section aria-label={title} className="mt-4">
      <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="font-normal">Name</th>
              <th className="text-right font-normal">Calls</th>
              <th className="text-right font-normal">In</th>
              <th className="text-right font-normal">Out</th>
              <th className="text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, t]) => (
              <Row key={k} label={k} t={t} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Totals overall, by purpose and by model, with the unpriced count (FR-046). */
export function CostBody({ totals }: { totals: CallTotals | null }) {
  if (totals === null) {
    return <p className="text-sm text-muted-foreground">Cost not loaded.</p>;
  }
  return (
    <div className="text-sm">
      <p>
        {totals.all.calls} calls, {totals.all.inputTokens} in /{" "}
        {totals.all.outputTokens} out, {usd(totals.all.costUsd)} total.
      </p>
      <p>Unpriced calls: {totals.all.unpricedCalls}</p>
      <Table title="By purpose" rows={Object.entries(totals.byPurpose)} />
      <Table title="By model" rows={Object.entries(totals.byModel)} />
    </div>
  );
}

export function CostPanel({
  open,
  onOpenChange,
  totals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totals: CallTotals | null;
}) {
  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title="Cost"
      description="Model call cost for this session."
    >
      <CostBody totals={totals} />
    </Panel>
  );
}
