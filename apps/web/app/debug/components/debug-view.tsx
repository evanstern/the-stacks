import type { Viewer } from "@the-stacks/session-model";
import { useMemo, useState } from "react";
import { actorLabel } from "../../play/labels.ts";
import type { FetchLike } from "../client.ts";
import { toJobView } from "../job-view.ts";
import { createFolder } from "../scrub.ts";
import { buildSeqIndex } from "../seq-index.ts";
import { type DebugSession, useDebugSession } from "../use-debug-session.ts";
import { toWaitingSummary } from "../waiting.ts";
import { CostPanel } from "./cost-panel.tsx";
import { EventLog } from "./event-log.tsx";
import { JobTimeline } from "./job-timeline.tsx";
import { JournalPanel } from "./journal-panel.tsx";
import { LedgerPanel } from "./ledger-panel.tsx";
import { SeedPanel } from "./seed-panel.tsx";
import { type PanelName, StateColumn } from "./state-column.tsx";
import { WaitingStrip } from "./waiting-strip.tsx";

const COLUMN = "min-h-0 overflow-y-auto p-3 text-sm text-muted-foreground";
// The jobs column hosts its own scroller (JobTimeline), so follow-bottom and
// scroll-into-view act on a bounded box on every width.
const JOBS_COLUMN =
  "flex min-h-0 max-h-[60dvh] flex-col p-3 text-sm text-muted-foreground xl:max-h-none";

export interface Selection {
  jobId: string | null;
  seq: number | null;
  pinnedSeq: number | null;
}

const DM: Viewer = { role: "dm" };

const NO_SELECTION: Selection = { jobId: null, seq: null, pinnedSeq: null };

/** The debug page: owns the poll hook, then lays out the board. */
export function DebugView({
  sessionId,
  fetchImpl,
}: {
  sessionId: string;
  fetchImpl?: FetchLike;
}) {
  const session = useDebugSession(sessionId, fetchImpl);
  return <DebugBoard session={session} />;
}

/**
 * The sticky strip over three columns (plan decision 7). Pure over `session`
 * apart from selection state, so tests can render it with a hand-built session.
 */
export function DebugBoard({
  session,
  initialSelection = NO_SELECTION,
}: {
  session: DebugSession;
  initialSelection?: Selection;
}) {
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [panel, setPanel] = useState<PanelName | null>(null);
  const { snapshot, projections, now } = session;
  const folder = useMemo(() => createFolder(DM), []);
  const shown = useMemo(
    () =>
      selection.pinnedSeq === null
        ? projections
        : folder.through(snapshot.events, selection.pinnedSeq),
    [folder, projections, snapshot.events, selection.pinnedSeq],
  );
  const closePanel = (open: boolean) => {
    if (!open) setPanel(null);
  };
  const summary = useMemo(
    () => toWaitingSummary(snapshot, projections, now),
    [snapshot, projections, now],
  );
  const views = useMemo(() => {
    const all = [...snapshot.jobs.values()];
    return all
      .map((j) => toJobView(j, snapshot.calls, now, all))
      .sort(
        (a, b) =>
          Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
          a.id.localeCompare(b.id),
      );
  }, [snapshot.jobs, snapshot.calls, now]);
  const index = useMemo(() => buildSeqIndex(views), [views]);

  const highlightedJobId =
    selection.jobId ??
    (selection.seq !== null ? index.jobFor(selection.seq) : null);
  const highlightSeqs = useMemo<ReadonlySet<number>>(
    () => views.find((v) => v.id === highlightedJobId)?.wroteSeqs ?? new Set(),
    [views, highlightedJobId],
  );

  const selectJob = (id: string) =>
    setSelection((s) => ({ ...s, jobId: id, seq: null }));
  const selectSeq = (seq: number) =>
    setSelection({ jobId: null, seq, pinnedSeq: seq });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col xl:h-dvh">
      <div className="sticky top-0 z-10">
        <WaitingStrip
          summary={summary}
          retry={session.retry}
          onRetry={session.onRetry}
        />
        {snapshot.notice && (
          <p
            role="status"
            className="border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
          >
            {snapshot.notice}
          </p>
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(20rem,1fr)_minmax(24rem,1.4fr)_minmax(20rem,1fr)]">
        <section aria-label="Jobs" className={JOBS_COLUMN}>
          <JobTimeline
            views={views}
            highlightedJobId={highlightedJobId}
            canLoadOlder={typeof snapshot.olderJobsBefore === "string"}
            onLoadOlder={session.loadOlderJobs}
            onSelectJob={selectJob}
            onSelectSeq={selectSeq}
          />
        </section>
        <section aria-label="Events" className={COLUMN}>
          <EventLog
            events={snapshot.events}
            actorName={(a) => actorLabel(a, projections.party, "")}
            highlightSeqs={highlightSeqs}
            selectedSeq={selection.seq}
            onSelectSeq={selectSeq}
          />
        </section>
        <section
          aria-label="State"
          data-pinned-seq={selection.pinnedSeq ?? undefined}
          className={COLUMN}
        >
          <StateColumn
            projection={shown}
            pinnedSeq={selection.pinnedSeq}
            onBackToLive={() =>
              setSelection((x) => ({ ...x, pinnedSeq: null }))
            }
            onOpenPanel={setPanel}
          />
        </section>
      </div>
      <SeedPanel
        open={panel === "seed"}
        onOpenChange={closePanel}
        seed={snapshot.seed}
      />
      <LedgerPanel
        open={panel === "ledger"}
        onOpenChange={closePanel}
        rows={shown.ledger}
        pinnedSeq={selection.pinnedSeq}
      />
      <JournalPanel
        open={panel === "journal"}
        onOpenChange={closePanel}
        entries={shown.journal}
        pinnedSeq={selection.pinnedSeq}
      />
      <CostPanel
        open={panel === "cost"}
        onOpenChange={closePanel}
        totals={snapshot.totals}
      />
    </div>
  );
}
