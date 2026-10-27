import type { JobSection, JobView } from "../job-view.ts";
import { ageText, costText, nodeName } from "../labels.ts";
import type {
  ReadAttempt,
  ReadCall,
  ReadFailure,
  ReadSubmission,
} from "../read-result.ts";

const BADGE_CLASS: Record<string, string> = {
  failed: "text-destructive",
  fallback: "text-amber-700 dark:text-amber-400",
  held: "text-amber-700 dark:text-amber-400",
  running: "text-primary",
};

function SeqLinks({
  seqs,
  onSelectSeq,
}: {
  seqs: number[] | undefined;
  onSelectSeq: (seq: number) => void;
}) {
  if (seqs === undefined) return <span>link not recorded</span>;
  if (seqs.length === 0) return <span>no events</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {seqs.map((s) => (
        <button
          key={s}
          type="button"
          data-seq-link={s}
          onClick={() => onSelectSeq(s)}
          className="rounded border border-border px-1 font-mono text-xs hover:bg-accent"
        >
          #{s}
        </button>
      ))}
    </span>
  );
}

function CallRows({ calls }: { calls: ReadCall[] }) {
  if (calls.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {calls.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: calls have no id
        <li key={i}>
          {c.purpose} · attempt {c.attempt} · {c.outcome}
          {c.errorKind ? ` (${c.errorKind})` : ""} ·{" "}
          {c.usage === null
            ? "usage not recorded"
            : `${c.usage.model ?? "model unknown"} · ${c.usage.inputTokens ?? "?"} in / ${c.usage.outputTokens ?? "?"} out · ${costText(c.usage.costUsd)}`}
        </li>
      ))}
    </ul>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Resolve({
  rows,
  onSelectSeq,
}: {
  rows: ReadSubmission[];
  onSelectSeq: (seq: number) => void;
}) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {rows.map((s) => (
        <li key={`${s.stepRef}:${s.key}`} className="text-xs">
          <span className="font-medium">{s.kind}</span> · {s.result}
          {s.refusalCode ? ` · refused: ${s.refusalCode}` : ""} ·{" "}
          <SeqLinks seqs={s.seqs} onSelectSeq={onSelectSeq} />
        </li>
      ))}
    </ul>
  );
}

function Attempts({ attempts }: { attempts: ReadAttempt[] }) {
  return (
    <ol className="mt-1 flex flex-col gap-1 text-xs">
      {attempts.map((a, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: attempts are ordered
        <li key={i} data-audit-attempt={i + 1}>
          Attempt {i + 1}: {a.words ?? "?"} words · prose hash{" "}
          <span className="font-mono">{a.proseHash ?? "not recorded"}</span>
          <div>
            Blocking:{" "}
            {a.blocking.length === 0
              ? "none"
              : a.blocking.map((x) => `${x.kind} ${x.detail}`).join("; ")}
          </div>
          <div>
            Advisory:{" "}
            {a.advisory.length === 0
              ? "none"
              : a.advisory.map((x) => `${x.kind} ${x.detail}`).join("; ")}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Failure({ failure }: { failure: ReadFailure }) {
  return (
    <div className="mt-1 text-xs">
      <p className="text-destructive">
        {failure.kind} at {failure.node}
        {failure.message ? ` — ${failure.message}` : ""}
      </p>
      {failure.excerpts.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: excerpts are ordered
        <div key={i} className="mt-1">
          Attempt {e.attempt ?? "?"} · {e.chars ?? "?"} chars · {e.issues}
          <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-muted p-2">
            {e.excerpt}
          </pre>
        </div>
      ))}
    </div>
  );
}

function SectionBody({
  view,
  section,
  onSelectSeq,
}: {
  view: JobView;
  section: JobSection;
  onSelectSeq: (seq: number) => void;
}) {
  if (!section.ran) {
    return <p className="text-xs text-muted-foreground">not run</p>;
  }
  let body: React.ReactNode;
  switch (section.node) {
    case "resolve":
      body = (
        <Resolve
          rows={section.data as ReadSubmission[]}
          onSelectSeq={onSelectSeq}
        />
      );
      break;
    case "narrate-audit": {
      const turn = view.read.kind === "turn" ? view.read.turn : null;
      const nar = turn?.checkpoint?.narration ?? null;
      body = (
        <div className="text-xs">
          {nar && (
            <>
              <p>
                {nar.shipped ? "Shipped" : "Not shipped"} ·{" "}
                <SeqLinks seqs={nar.seqs} onSelectSeq={onSelectSeq} />
              </p>
              <Attempts attempts={nar.attempts} />
            </>
          )}
          {view.badge === "fallback" && (
            <p className="text-amber-700 dark:text-amber-400">
              Fallback narration shipped.
            </p>
          )}
        </div>
      );
      break;
    }
    case "failure":
      body = <Failure failure={section.data as ReadFailure} />;
      break;
    default:
      body = <Json value={section.data} />;
  }
  return (
    <>
      {body}
      <CallRows calls={section.calls} />
    </>
  );
}

/** One job in the timeline. Pure over its props; the parent owns expansion. */
export function JobCard({
  view,
  expanded,
  highlighted = false,
  onToggle,
  onSelectSeq,
}: {
  view: JobView;
  expanded: boolean;
  highlighted?: boolean;
  onToggle: () => void;
  onSelectSeq: (seq: number) => void;
}) {
  const t = view.totals;
  return (
    <article
      data-job-card={view.id}
      data-highlight={highlighted ? "true" : undefined}
      className={`rounded border bg-card p-2 text-foreground ${highlighted ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 text-left text-sm"
      >
        <span className="font-semibold">{view.kind}</span>
        <span className="text-muted-foreground">{view.trigger}</span>
        <span>{view.status}</span>
        <span className={`font-medium ${BADGE_CLASS[view.badge] ?? ""}`}>
          {view.badge}
        </span>
        <span>
          {view.durationMs === null ? "no duration" : ageText(view.durationMs)}
        </span>
        <span>attempts {view.attempts}</span>
        <span>{t.calls} calls</span>
        <span>{t.inputTokens + t.outputTokens} tokens</span>
        <span>
          {t.calls === 0
            ? "no cost"
            : t.unpricedCalls > 0 && t.costUsd === 0
              ? costText(null)
              : costText(t.costUsd)}
          {t.unpricedCalls > 0 && t.costUsd > 0
            ? ` + ${t.unpricedCalls} unpriced`
            : ""}
        </span>
      </button>
      {view.linkUnknown && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          link unknown: events written by this job may not be marked.
        </p>
      )}
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {view.heldBy && (
            <p className="text-xs">
              Held; companion job {view.heldBy.id} is {view.heldBy.status}.
            </p>
          )}
          {view.read.kind === "turn" &&
            view.sections.map((s) => (
              <section
                key={s.node}
                data-node={s.node}
                aria-label={nodeName(s.node)}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {nodeName(s.node)}
                </h4>
                <SectionBody
                  view={view}
                  section={s}
                  onSelectSeq={onSelectSeq}
                />
              </section>
            ))}
          {view.read.kind === "companion" && (
            <section aria-label="Companion plays">
              {view.read.companion.plays.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: plays are ordered
                <div key={i} className="text-xs">
                  <p className="font-medium">{p.companion}</p>
                  <ul>
                    {p.submissions.map((s, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: ordered
                      <li key={j}>
                        {s.kind} · {s.ok ? "ok" : `failed ${s.code ?? ""}`} ·{" "}
                        <SeqLinks seqs={s.seqs} onSelectSeq={onSelectSeq} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <CallRows calls={view.read.companion.calls} />
            </section>
          )}
          {view.read.kind === "chronicle" && (
            <section aria-label="Chronicle">
              <p className="text-xs">
                {view.read.chronicle.entries} entries ·{" "}
                <SeqLinks
                  seqs={view.read.chronicle.seqs}
                  onSelectSeq={onSelectSeq}
                />
              </p>
              <CallRows calls={view.read.chronicle.calls} />
            </section>
          )}
        </div>
      )}
    </article>
  );
}
