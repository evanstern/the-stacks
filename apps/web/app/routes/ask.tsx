import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { splitPassage } from "~/ask/highlight";
import type { Turn } from "~/ask/turns";
import type { Citation, PassageKind } from "~/ask/types";
import { ChevronIcon, StopIcon } from "~/components/icons";
import { Sources } from "~/components/sources";
import { stacksContext } from "~/context";
import { cn } from "~/lib/utils";
import { OperatorOnly } from "~/shell/operator-only";
import { useAppStore, useAppStoreHandle } from "~/store/provider";
import type { Route } from "./+types/ask";

/**
 * Ask (plan D4, D10, D11; US2 FR-021-FR-031, US3 FR-032-FR-036). Loader
 * mirrors T026's Library pattern: `{ forbidden: true }` for a player
 * without calling `jobs()`, else `{ jobs }`. The conversation, streaming,
 * stop, retry, and the open citation all live in the store (plan D8) so
 * they survive navigation (FR-028).
 */
export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context.get(stacksContext);
  const user = await ctx.identity();
  if (user?.role !== "operator") {
    return { forbidden: true as const, jobs: null };
  }
  return { forbidden: false as const, jobs: await ctx.jobs() };
}

function badge(turn: Turn): { text: string; className: string } | null {
  if (turn.state === "stopped") {
    return { text: "Stopped", className: "bg-muted text-muted-foreground" };
  }
  if (turn.state === "interrupted") {
    return {
      text: "Interrupted",
      className: "bg-destructive-surface text-destructive",
    };
  }
  return null;
}

/** FR-034: the source pane's label for each `passage.kind`. */
function kindLabel(kind: PassageKind): string {
  const labels: Record<PassageKind, string> = {
    heading: "Heading",
    prose: "Prose",
    list: "List",
    table: "Table",
    statBlock: "Stat block",
    sidebar: "Sidebar",
  };
  return labels[kind];
}

/** FR-032: the citation marker's accessible name — number, book, section. */
function citationLabel(n: number, citation: Citation): string {
  const section = citation.section.length
    ? `, ${citation.section.join(" › ")}`
    : "";
  return `Citation ${n}: ${citation.book}${section}`;
}

function TurnView({
  turn,
  openN,
  onOpenCitation,
  onRetry,
}: {
  turn: Turn;
  openN: number | null;
  onOpenCitation: (turnId: string, n: number) => void;
  onRetry: (turnId: string) => void;
}) {
  const mark = badge(turn);
  return (
    <div className="flex flex-col gap-2">
      <p className="self-end rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
        {turn.question}
      </p>
      {turn.state === "refused" ? (
        <div role="status" className="rounded-lg bg-muted p-3 text-sm">
          <p>{turn.message}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap">
            {turn.parts.map((part, index) =>
              part.type === "text" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a turn; index is stable.
                <span key={index}>{part.text}</span>
              ) : (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only within a turn; index is stable.
                  key={index}
                  type="button"
                  onClick={() => onOpenCitation(turn.id, part.n)}
                  aria-label={citationLabel(part.n, turn.citations[part.n])}
                  aria-pressed={openN === part.n}
                  title={turn.citations[part.n].quote}
                  className="citation mx-0.5 rounded border border-border px-1 text-xs text-primary aria-pressed:bg-accent"
                >
                  [{part.n}]
                </button>
              ),
            )}
            {turn.state === "streaming" && (
              <span aria-hidden="true" className="animate-pulse">
                ▍
              </span>
            )}
          </p>
          {mark && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${mark.className}`}
            >
              {mark.text}
            </span>
          )}
          {turn.state === "done" &&
            turn.summary &&
            turn.summary.dropped > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {turn.summary.dropped} citation
                {turn.summary.dropped === 1 ? "" : "s"} could not be verified
                and were left out.
              </p>
            )}
          {turn.state === "interrupted" && (
            <>
              <div
                role="alert"
                className="mt-2 rounded-lg bg-destructive-surface p-2 text-destructive text-sm"
              >
                <p>{turn.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onRetry(turn.id)}
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The source pane (plan D11, FR-033-FR-035): book, section breadcrumb,
 * kind label, and the passage with the quote in a `<mark>`, scrolled into
 * view. Desktop-collapsible; on `narrow:` its visibility instead follows
 * the Chat | Source control, so `collapsed` is overridden there.
 */
function SourcePane({
  citation,
  collapsed,
  mobileHidden,
  onToggleCollapse,
  onBack,
}: {
  citation: Citation | null;
  collapsed: boolean;
  mobileHidden: boolean;
  onToggleCollapse: () => void;
  onBack: () => void;
}) {
  const markRef = useRef<HTMLElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll once per newly opened citation.
  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "nearest" });
  }, [citation]);

  const parts = citation
    ? splitPassage(citation.passage.text, citation.quoteInPassage)
    : null;

  return (
    <aside
      aria-label="Source"
      className={cn(
        "flex w-80 shrink-0 flex-col gap-2 border-l border-border pl-4 narrow:w-full narrow:border-t narrow:border-l-0 narrow:pt-4 narrow:pl-0",
        mobileHidden && "narrow:hidden",
      )}
    >
      <button
        type="button"
        onClick={onBack}
        className="hidden items-center gap-1 self-start text-sm text-primary underline-offset-4 hover:underline narrow:inline-flex"
      >
        <ChevronIcon />
        Back to answer
      </button>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Source passage</h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-controls="source-body"
          aria-label={collapsed ? "Expand source pane" : "Collapse source pane"}
          className="inline-flex rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground narrow:hidden"
        >
          <ChevronIcon
            className={
              !collapsed
                ? "rotate-90 transition-transform"
                : "transition-transform"
            }
          />
        </button>
      </div>
      <div
        id="source-body"
        className={cn(
          "flex flex-col gap-1 text-sm",
          collapsed && "hidden narrow:flex",
        )}
      >
        {citation && parts ? (
          <>
            <p className="font-semibold">{citation.book}</p>
            {citation.section.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {citation.section.join(" › ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {kindLabel(citation.passage.kind)}
            </p>
            <p
              className={cn(
                "whitespace-pre-wrap",
                citation.passage.kind === "table" && "font-mono",
              )}
            >
              {parts[0]}
              <mark ref={markRef} className="bg-mark text-mark-foreground">
                {parts[1]}
              </mark>
              {parts[2]}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">No citation selected.</p>
        )}
      </div>
    </aside>
  );
}

export default function Ask({ loaderData }: Route.ComponentProps) {
  const store = useAppStoreHandle();
  const turns = useAppStore((state) => state.turns);
  const askError = useAppStore((state) => state.askError);
  const storeForbidden = useAppStore((state) => state.forbidden);
  const storeJobs = useAppStore((state) => state.jobs);
  const openCitation = useAppStore((state) => state.openCitation);
  const [question, setQuestion] = useState("");
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "source">("chat");

  useEffect(() => setMounted(true), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once from this request's loader data — store is a stable handle, not reactive state.
  useEffect(() => {
    if (!loaderData.forbidden) store.seedJobs(loaderData.jobs ?? []);
  }, [loaderData]);

  if (loaderData.forbidden || storeForbidden) {
    return (
      <OperatorOnly message="Asking the library is available to the operator only." />
    );
  }

  // Falls back to loader data before hydration seeds the store, so SSR
  // and the first client paint agree (plan D4, same pattern as books.tsx).
  const jobs = storeJobs ?? loaderData.jobs ?? [];
  const streaming = turns.some((turn) => turn.state === "streaming");
  const promptDisabled = !mounted || streaming || jobs.length === 0;
  const openTurn = openCitation
    ? turns.find((turn) => turn.id === openCitation.turnId)
    : undefined;
  const openedCitation =
    openCitation && openTurn
      ? (openTurn.citations[openCitation.n] ?? null)
      : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    store.ask(question);
    setQuestion("");
  }

  function handleOpenCitation(turnId: string, n: number) {
    store.openCitation(turnId, n);
    setMobileView("source"); // FR-036: opening a citation switches to Source.
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Ask</h1>
        <Sources />
      </div>

      <fieldset className="m-0 hidden gap-1 self-start rounded-full border border-border p-1 narrow:flex">
        <legend className="sr-only">Ask view</legend>
        <button
          type="button"
          aria-pressed={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
          className="rounded-full px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          Chat
        </button>
        <button
          type="button"
          aria-pressed={mobileView === "source"}
          onClick={() => setMobileView("source")}
          className="rounded-full px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          Source
        </button>
      </fieldset>

      <div className="flex flex-1 gap-4 narrow:flex-col">
        <div
          className={cn(
            "flex flex-1 flex-col gap-4",
            mobileView === "source" && "narrow:hidden",
          )}
        >
          <section
            aria-label="Conversation"
            className="flex flex-1 flex-col gap-4"
          >
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Import a book to start asking.{" "}
                <Link
                  to="/books"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Library
                </Link>
              </p>
            ) : turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask anything about the books above.
              </p>
            ) : (
              turns.map((turn) => (
                <TurnView
                  key={turn.id}
                  turn={turn}
                  openN={
                    openCitation?.turnId === turn.id ? openCitation.n : null
                  }
                  onOpenCitation={handleOpenCitation}
                  onRetry={store.retry}
                />
              ))
            )}
          </section>

          {streaming && (
            <button
              type="button"
              onClick={() => store.stop()}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              <StopIcon />
              Stop generating
            </button>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <label htmlFor="ask-question" className="sr-only">
                Ask a rules question
              </label>
              <input
                id="ask-question"
                value={question}
                maxLength={2000}
                disabled={promptDisabled}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a rules question…"
                aria-invalid={askError ? true : undefined}
                aria-describedby={askError ? "ask-error" : undefined}
                className="h-10 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={promptDisabled}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Ask
              </button>
            </div>
            {askError && (
              <p
                id="ask-error"
                role="alert"
                className="mt-1 text-sm text-destructive"
              >
                {askError}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Answers quote only your library. Click a citation to see the
              source.
            </p>
          </form>
        </div>

        <SourcePane
          citation={openedCitation}
          collapsed={collapsed}
          mobileHidden={mobileView === "chat"}
          onToggleCollapse={() => setCollapsed((was) => !was)}
          onBack={() => setMobileView("chat")}
        />
      </div>
    </div>
  );
}
