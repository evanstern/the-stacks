import type { LedgerRow } from "@the-stacks/session-model";
import { Panel } from "~/components/panel";
import { LedgerList } from "../../play/components/ledger-list.tsx";
import { toLedgerItems } from "../../play/ledger-format.ts";

/** Ledger rows through the projection's seq (FR-045). */
export function LedgerBody({ rows }: { rows: readonly LedgerRow[] }) {
  return <LedgerList items={toLedgerItems(rows)} />;
}

export function LedgerPanel({
  open,
  onOpenChange,
  rows,
  pinnedSeq,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly LedgerRow[];
  pinnedSeq: number | null;
}) {
  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title={pinnedSeq === null ? "Ledger" : `Ledger at seq ${pinnedSeq}`}
      description="Rolls, outcomes and changes."
    >
      <LedgerBody rows={rows} />
    </Panel>
  );
}
