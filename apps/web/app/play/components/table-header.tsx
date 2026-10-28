import { ApprovalsIcon, ChevronIcon, LedgerIcon } from "~/components/icons";
import type { PresenceRow } from "../presence.ts";
import type { FloorInput, SourceStatus } from "../source.ts";
import type { TableViewModel } from "../view-model.ts";
import { FloorControls } from "./floor-controls.tsx";
import { ModeBadge } from "./mode-badge.tsx";
import { PresenceStrip } from "./presence-strip.tsx";
import { SCENE_PANEL_ID } from "./scene-panel.tsx";
import { START_SCENE_PANEL_ID } from "./start-scene-panel.tsx";

const STATUS_TEXT: Record<SourceStatus, string> = {
  connecting: "Connecting…",
  open: "Connected",
  retrying: "Reconnecting…",
  fixture: "Fixture",
};

export const LEDGER_PANEL_ID = "ledger-panel";
export const APPROVALS_PANEL_ID = "approvals-panel";

const TRIGGER =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent aria-expanded:bg-accent";

export function TableHeader({
  model,
  status,
  presence,
  ledgerOpen,
  approvalsOpen,
  sceneOpen,
  debugHref,
  onLedger,
  onApprovals,
  onScene,
  onFloor,
  onStartScene,
  startQueued = false,
}: {
  model: TableViewModel;
  status: SourceStatus;
  presence: readonly PresenceRow[];
  ledgerOpen: boolean;
  approvalsOpen: boolean;
  sceneOpen: boolean;
  debugHref?: string;
  onLedger: () => void;
  onApprovals: () => void;
  /** Present only for the DM seat; opens the Change scene slide-out. */
  onScene?: () => void;
  onFloor: (input: FloorInput) => boolean;
  /** Present only when the operator may start a scene. */
  onStartScene?: () => void;
  startQueued?: boolean;
}) {
  const chevron = (open: boolean) => (
    <ChevronIcon
      className={
        open ? "rotate-90 transition-transform" : "transition-transform"
      }
    />
  );
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">
          {model.scene?.title ?? "No scene yet"}
        </h1>
        {model.scene?.location && (
          <p className="truncate text-xs text-muted-foreground">
            {model.scene.location}
          </p>
        )}
      </div>
      <PresenceStrip rows={presence} />
      <ModeBadge mode={model.mode} />
      <FloorControls controls={model.floor} onFloor={onFloor} />
      <span className="text-xs text-muted-foreground">
        {STATUS_TEXT[status]}
      </span>
      <button
        type="button"
        onClick={onLedger}
        aria-expanded={ledgerOpen}
        aria-controls={LEDGER_PANEL_ID}
        className={TRIGGER}
      >
        <LedgerIcon />
        <span>Ledger</span>
        {chevron(ledgerOpen)}
      </button>
      {model.isDm && (
        <button
          type="button"
          onClick={onApprovals}
          aria-expanded={approvalsOpen}
          aria-controls={APPROVALS_PANEL_ID}
          className={TRIGGER}
        >
          <ApprovalsIcon />
          <span>Pending proposals ({model.proposals.length})</span>
          {chevron(approvalsOpen)}
        </button>
      )}
      {model.isDm && onScene && (
        <button
          type="button"
          onClick={onScene}
          aria-expanded={sceneOpen}
          aria-controls={SCENE_PANEL_ID}
          className={TRIGGER}
        >
          <span>Change scene</span>
          {chevron(sceneOpen)}
        </button>
      )}
      {startQueued && (
        <span role="status" className="text-xs text-muted-foreground">
          Scene start queued.
        </span>
      )}
      {onStartScene && (
        <button
          type="button"
          onClick={onStartScene}
          aria-controls={START_SCENE_PANEL_ID}
          className={TRIGGER}
        >
          Start scene
        </button>
      )}
      {debugHref && (
        <a href={debugHref} target="_blank" rel="noopener" className={TRIGGER}>
          Debug
        </a>
      )}
    </header>
  );
}
