import { ageText } from "../labels.ts";
import type { RetryState } from "../use-debug-session.ts";
import type { WaitingSummary } from "../waiting.ts";

/** The sticky "why is the table waiting?" strip. Pure over its props. */
export function WaitingStrip({
  summary,
  retry,
  onRetry,
}: {
  summary: WaitingSummary;
  retry: RetryState;
  onRetry: () => void;
}) {
  const idle =
    summary.active.length === 0 &&
    summary.uncommitted.length === 0 &&
    summary.proposals.length === 0 &&
    summary.holds.length === 0 &&
    summary.latestFailure === null;
  return (
    <section
      aria-label="Why the table is waiting"
      className="flex flex-col gap-1.5 border-b border-border bg-card px-3 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold">
          {summary.mode.kind === "turn"
            ? `Turn mode: ${summary.mode.actorLabel}${summary.mode.round === null ? "" : ` (round ${summary.mode.round})`}`
            : "Free mode"}
        </span>
        {idle && <span className="text-muted-foreground">nothing queued</span>}
        {summary.stuck && (
          <span className="text-amber-700 dark:text-amber-400">
            Committed action with no narration.
          </span>
        )}
      </div>
      {summary.active.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {summary.active.map((j) => (
            <li key={j.id} data-job={j.id} className="flex flex-wrap gap-x-3">
              <span className="font-medium">{j.kind}</span>
              <span>stage {j.stage ?? "none"}</span>
              <span>attempts {j.attempts}</span>
              <span className="text-muted-foreground">
                {j.heartbeatAgeMs === null
                  ? "no heartbeat"
                  : `heartbeat ${ageText(j.heartbeatAgeMs)} ago`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {summary.uncommitted.length > 0 && (
        <p>
          Uncommitted actions:{" "}
          {summary.uncommitted
            .map((a) => `${a.actorLabel} (${a.status})`)
            .join(", ")}
        </p>
      )}
      {summary.proposals.length > 0 && (
        <p>
          Pending proposals:{" "}
          {summary.proposals.map((p) => `${p.kind} (${p.policy})`).join(", ")}
        </p>
      )}
      {summary.holds.map((h) => (
        <p key={h.turnJobId}>
          Held turn {h.turnJobId}: companion{" "}
          {h.companionJobId === null
            ? "not queued"
            : `${h.companionJobId} ${h.companionStatus}`}
        </p>
      ))}
      {summary.latestFailure && (
        <p className="text-destructive">
          Latest failure: {summary.latestFailure.kind} at{" "}
          {summary.latestFailure.node}
          {summary.latestFailure.message
            ? ` — ${summary.latestFailure.message}`
            : ""}
        </p>
      )}
      {summary.showRetry && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            disabled={retry.inFlight}
            className="rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
          >
            {retry.inFlight ? "Retrying…" : "Retry the turn"}
          </button>
          {retry.jobId && (
            <span className="text-muted-foreground">
              Queued job {retry.jobId}
            </span>
          )}
          {retry.refusal && (
            <span role="alert" className="text-destructive">
              {retry.refusal}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
