import { project } from "@the-stacks/session-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "~/components/panel";
import { Composer } from "./components/composer.tsx";
import { LedgerList } from "./components/ledger-list.tsx";
import { ProposalList } from "./components/proposal-list.tsx";
import { SCENE_PANEL_ID, ScenePanel } from "./components/scene-panel.tsx";
import { StartScenePanel } from "./components/start-scene-panel.tsx";
import {
  APPROVALS_PANEL_ID,
  LEDGER_PANEL_ID,
  TableHeader,
} from "./components/table-header.tsx";
import { Transcript } from "./components/transcript.tsx";
import { TurnOrder } from "./components/turn-order.tsx";
import { presenceRows } from "./presence.ts";
import type { TableSource } from "./source.ts";
import { toTableViewModel } from "./view-model.ts";

/**
 * The one table view both routes render (AC #7). Everything shown derives from the source's
 * events and viewer; the only state here is UI state (which panel is open).
 */
export function TableView({
  source,
  debugHref,
}: {
  source: TableSource;
  debugHref?: string;
}) {
  const { events, viewer, actor, proposals } = source;
  const projected = useMemo(() => project(events, viewer), [events, viewer]);
  const presentIds = useMemo(
    () => source.presence?.map((e) => e.userId) ?? null,
    [source.presence],
  );
  const model = useMemo(
    () =>
      toTableViewModel(projected, { actor, proposals, present: presentIds }),
    [projected, actor, proposals, presentIds],
  );
  const presence = useMemo(
    () => presenceRows(source.presence, projected),
    [source.presence, projected],
  );
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const { startScene } = source.commands;
  const canStart =
    source.kind === "live" &&
    source.role === "operator" &&
    source.caughtUp &&
    model.scene === null &&
    source.sceneStart === "none" &&
    startScene !== undefined;
  const startNote =
    model.scene === null &&
    (source.sceneStart === "queued" || source.sceneStart === "pending")
      ? source.sceneStart
      : undefined;
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
        presence={presence}
        ledgerOpen={ledgerOpen}
        approvalsOpen={approvalsOpen}
        sceneOpen={sceneOpen}
        debugHref={debugHref}
        onLedger={() => setLedgerOpen((was) => !was)}
        onApprovals={() => setApprovalsOpen((was) => !was)}
        onScene={
          model.sceneChange ? () => setSceneOpen((was) => !was) : undefined
        }
        onFloor={source.commands.floor}
        onStartScene={canStart ? () => setStartOpen(true) : undefined}
        startNote={startNote}
      />
      {model.mode.mode === "turn" && <TurnOrder order={model.mode.order} />}
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
      <Panel
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        title="Ledger"
        description="Every roll with its reason and every change with before and after."
        id={LEDGER_PANEL_ID}
      >
        <LedgerList items={model.ledger} />
      </Panel>
      {canStart && startScene && (
        <StartScenePanel
          open={startOpen}
          onOpenChange={setStartOpen}
          present={source.presence ?? []}
          startScene={startScene}
        />
      )}
      {model.sceneChange && (
        <Panel
          open={sceneOpen}
          onOpenChange={setSceneOpen}
          title="Change scene"
          description="Change the scene, or carry out a scene suggestion."
          id={SCENE_PANEL_ID}
        >
          <ScenePanel
            view={model.sceneChange}
            onApply={(input) => {
              const ok = source.commands.changeScene(input);
              if (ok) setSceneOpen(false);
              return ok;
            }}
          />
        </Panel>
      )}
      {model.isDm && (
        <Panel
          open={approvalsOpen}
          onOpenChange={setApprovalsOpen}
          title="Pending proposals"
          description="Approve or reject each proposal. Dismiss a suggestion once you have acted on it."
          id={APPROVALS_PANEL_ID}
        >
          <ProposalList
            proposals={model.proposals}
            onApprove={(id) => source.commands.approve(id)}
            onReject={(id, reason) => source.commands.reject(id, reason)}
          />
        </Panel>
      )}
    </div>
  );
}
