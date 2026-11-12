import { project } from "@the-stacks/session-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "~/components/panel";
import { Composer } from "./components/composer.tsx";
import { DM_SEAT_PANEL_ID, DmSeatPanel } from "./components/dm-seat-panel.tsx";
import { LedgerList } from "./components/ledger-list.tsx";
import { Margin } from "./components/margin.tsx";
import { MiniStrip } from "./components/mini-strip.tsx";
import { PARTY_PANEL_ID, PartyPanel } from "./components/party-panel.tsx";
import { ProposalList } from "./components/proposal-list.tsx";
import { ReadRing } from "./components/read-ring.tsx";
import { SCENE_PANEL_ID, ScenePanel } from "./components/scene-panel.tsx";
import { StartScenePanel } from "./components/start-scene-panel.tsx";
import { StatusStrip } from "./components/status-strip.tsx";
import {
  APPROVALS_PANEL_ID,
  LEDGER_PANEL_ID,
  TableHeader,
} from "./components/table-header.tsx";
import {
  TABLE_MODE_PANEL_ID,
  TableModePanel,
} from "./components/table-mode-panel.tsx";
import { Transcript } from "./components/transcript.tsx";
import { conditionText } from "./conditions.ts";
import { dmSeatView } from "./dm-seat.ts";
import { partyRows } from "./party.ts";
import { presenceRows } from "./presence.ts";
import { readIndicator } from "./read-ring.ts";
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
  const party = useMemo(
    () => partyRows(projected, source.presence),
    [projected, source.presence],
  );
  const ownConditions = useMemo(
    () =>
      projected.party.find(
        (m) =>
          m.controller.kind === "player" &&
          projected.viewer.role === "player" &&
          m.controller.userId === projected.viewer.userId,
      )?.combatant?.conditions ?? [],
    [projected],
  );
  const conditionLines = useMemo(() => {
    const src = projected.encounter
      ? projected.encounter.order.map((o) => ({
          name: o.name,
          conditions: o.conditions,
        }))
      : projected.party.map((m) => ({
          name: m.name,
          conditions: m.combatant?.conditions ?? [],
        }));
    return src
      .filter((c) => c.conditions.length > 0)
      .map((c) => ({ name: c.name, text: conditionText(c.conditions) }));
  }, [projected]);
  const [partyOpen, setPartyOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);
  const { seatDm } = source.commands;
  const canSeat =
    source.kind === "live" &&
    source.role === "operator" &&
    source.caughtUp &&
    seatDm !== undefined;
  const seatView = useMemo(
    () =>
      dmSeatView(
        projected,
        source.presence,
        source.actor,
        model.isDm ? model.proposals.length : null,
      ),
    [projected, source.presence, source.actor, model.isDm, model.proposals],
  );
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
  const composerRef = useRef<HTMLInputElement>(null);
  // The projection keeps only the marker's seq; its `ts` starts Thinking's 30 s cap (FR-025).
  const markerTs = useMemo(
    () =>
      projected.presence?.purpose === "read"
        ? (events.find((e) => e.seq === projected.presence?.seq)?.ts ?? null)
        : null,
    [events, projected.presence],
  );
  const [now, setNow] = useState(() => Date.now());
  const indicator = readIndicator(projected, viewer, now, markerTs);
  // The 1 s ticker runs only while the ring or Thinking shows, or a post is waiting to show it.
  const ticking =
    indicator.kind !== "hidden" ||
    readIndicator(projected, viewer, Number.MAX_SAFE_INTEGER, markerTs).kind ===
      "ring";
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
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
        partyOpen={partyOpen}
        approvalsOpen={approvalsOpen}
        sceneOpen={sceneOpen}
        modeOpen={modeOpen}
        seatOpen={seatOpen}
        debugHref={debugHref}
        onLedger={() => setLedgerOpen((was) => !was)}
        onParty={() => setPartyOpen((was) => !was)}
        onApprovals={() => setApprovalsOpen((was) => !was)}
        onScene={
          model.sceneChange ? () => setSceneOpen((was) => !was) : undefined
        }
        onMode={model.tableMode ? () => setModeOpen((was) => !was) : undefined}
        onFloor={source.commands.floor}
        onStartScene={canStart ? () => setStartOpen(true) : undefined}
        onSeat={canSeat ? () => setSeatOpen((was) => !was) : undefined}
        startNote={startNote}
      />
      {model.hiddenCount > 0 && (
        <p className="border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          {model.hiddenCount} entries not shown
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!source.caughtUp ? (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            ) : (
              <Transcript
                items={model.transcript}
                commands={source.commands}
                onNotQuite={() => composerRef.current?.focus()}
              />
            )}
            <div ref={endRef} />
          </div>
          <MiniStrip party={party} mode={model.mode} />
          <StatusStrip
            own={party.find((r) => r.isOwn) ?? null}
            conditions={ownConditions}
            mode={model.mode}
          />
        </div>
        <Margin party={party} mode={model.mode} conditions={conditionLines} />
      </div>
      <ReadRing indicator={indicator} />
      <Composer
        composer={model.composer}
        commands={source.commands}
        inputRef={composerRef}
        thinking={indicator.kind === "thinking"}
        disabled={
          source.status === "connecting" || source.status === "retrying"
        }
        notice={source.notice}
      />
      <Panel
        open={partyOpen}
        onOpenChange={setPartyOpen}
        title="Party"
        description="Each party character, who controls it, and its vitals."
        id={PARTY_PANEL_ID}
      >
        <PartyPanel
          rows={party}
          order={model.mode.mode === "turn" ? model.mode.order : []}
        />
      </Panel>
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
          dmUserId={
            projected.gate.seat.kind === "human"
              ? projected.gate.seat.userId
              : null
          }
        />
      )}
      {canSeat && seatDm && (
        <Panel
          open={seatOpen}
          onOpenChange={setSeatOpen}
          title="DM seat"
          description="Seat a human DM, or return the seat to the AI DM."
          id={DM_SEAT_PANEL_ID}
        >
          <DmSeatPanel
            view={seatView}
            onSeat={(input) => {
              const ok = seatDm(input);
              if (ok) setSeatOpen(false);
              return ok;
            }}
          />
        </Panel>
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
      {model.tableMode && (
        <Panel
          open={modeOpen}
          onOpenChange={setModeOpen}
          title="Table mode"
          description="End the encounter, or switch between free and turn mode."
          id={TABLE_MODE_PANEL_ID}
        >
          <TableModePanel
            view={model.tableMode}
            onEndEncounter={(input) => {
              const ok = source.commands.endEncounter(input);
              if (ok) setModeOpen(false);
              return ok;
            }}
            onSetMode={(input) => {
              const ok = source.commands.setTableMode(input);
              if (ok) setModeOpen(false);
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
