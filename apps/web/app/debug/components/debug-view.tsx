import { useMemo } from "react";
import type { FetchLike } from "../client.ts";
import { useDebugSession } from "../use-debug-session.ts";
import { toWaitingSummary } from "../waiting.ts";
import { WaitingStrip } from "./waiting-strip.tsx";

const COLUMN = "min-h-0 overflow-y-auto p-3 text-sm text-muted-foreground";

/** The debug page: a sticky strip over three columns (plan decision 7). */
export function DebugView({
  sessionId,
  fetchImpl,
}: {
  sessionId: string;
  fetchImpl?: FetchLike;
}) {
  const session = useDebugSession(sessionId, fetchImpl);
  const summary = useMemo(
    () => toWaitingSummary(session.snapshot, session.projections, session.now),
    [session.snapshot, session.projections, session.now],
  );
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10">
        <WaitingStrip
          summary={summary}
          retry={session.retry}
          onRetry={session.onRetry}
        />
        {session.snapshot.notice && (
          <p
            role="status"
            className="border-b border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
          >
            {session.snapshot.notice}
          </p>
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(20rem,1fr)_minmax(24rem,1.4fr)_minmax(20rem,1fr)]">
        <section aria-label="Jobs" className={COLUMN}>
          Jobs
        </section>
        <section aria-label="Events" className={COLUMN}>
          Events
        </section>
        <section aria-label="State" className={COLUMN}>
          State
        </section>
      </div>
    </div>
  );
}
