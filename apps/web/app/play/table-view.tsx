import { project } from "@the-stacks/session-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "./components/composer.tsx";
import { TableHeader } from "./components/table-header.tsx";
import { Transcript } from "./components/transcript.tsx";
import type { TableSource } from "./source.ts";
import { toTableViewModel } from "./view-model.ts";

/**
 * The one table view both routes render (AC #7). Everything shown derives from the source's
 * events and viewer; the only state here is UI state (which panel is open).
 */
export function TableView({ source }: { source: TableSource }) {
  const { events, viewer, actor, proposals } = source;
  const model = useMemo(
    () => toTableViewModel(project(events, viewer), { actor, proposals }),
    [events, viewer, actor, proposals],
  );
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const count = model.transcript.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the transcript grows.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [count]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <TableHeader
        model={model}
        status={source.status}
        ledgerOpen={ledgerOpen}
        approvalsOpen={approvalsOpen}
        onLedger={() => setLedgerOpen((was) => !was)}
        onApprovals={() => setApprovalsOpen((was) => !was)}
      />
      {model.hiddenCount > 0 && (
        <p className="border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {model.hiddenCount} entries not shown
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!source.caughtUp ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : (
          <Transcript items={model.transcript} commands={source.commands} />
        )}
        <div ref={endRef} />
      </div>
      <Composer
        composer={model.composer}
        onTalk={source.commands.sendTalk}
        onDeclare={source.commands.declareAction}
        disabled={
          source.status === "connecting" || source.status === "retrying"
        }
        notice={source.notice}
      />
    </div>
  );
}
