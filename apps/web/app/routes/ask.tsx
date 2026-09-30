import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Turn } from "~/ask/turns";
import { StopIcon } from "~/components/icons";
import { Sources } from "~/components/sources";
import { stacksContext } from "~/context";
import { OperatorOnly } from "~/shell/operator-only";
import { useAppStore, useAppStoreHandle } from "~/store/provider";
import type { Route } from "./+types/ask";

/**
 * Ask (plan D4, D10; US2, FR-021-FR-031). Loader mirrors T026's Library
 * pattern: `{ forbidden: true }` for a player without calling `jobs()`,
 * else `{ jobs }`. The conversation, streaming, stop, and retry live in
 * the store (plan D8) so they survive navigation (FR-028).
 *
 * Citation click-through and the source pane are Phase 4 (T036-T038):
 * markers render here as inert buttons only, per T034's scope.
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

function TurnView({
  turn,
  onRetry,
}: {
  turn: Turn;
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
                  aria-label={`Citation ${part.n}`}
                  className="citation mx-0.5 rounded border border-border px-1 text-xs text-primary"
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

export default function Ask({ loaderData }: Route.ComponentProps) {
  const store = useAppStoreHandle();
  const turns = useAppStore((state) => state.turns);
  const askError = useAppStore((state) => state.askError);
  const storeForbidden = useAppStore((state) => state.forbidden);
  const storeJobs = useAppStore((state) => state.jobs);
  const [question, setQuestion] = useState("");
  const [mounted, setMounted] = useState(false);

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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    store.ask(question);
    setQuestion("");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Ask</h1>
        <Sources />
      </div>

      <section aria-label="Conversation" className="flex flex-1 flex-col gap-4">
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
            <TurnView key={turn.id} turn={turn} onRetry={store.retry} />
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
          Answers quote only your library. Click a citation to see the source.
        </p>
      </form>
    </div>
  );
}
