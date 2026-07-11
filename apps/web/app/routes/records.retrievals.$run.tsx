/**
 * /records/retrievals/:run — one receipt, in full (spec 010 US2). Renders
 * from the run's OWN snapshots, so this page keeps working after re-ingests
 * sweep the live chunks (Principle III) — a passage whose text no longer
 * exists at the source's current generation renders with a "superseded"
 * badge, derived at view time, never stored. Per-stage scores and timings
 * make the ranking auditable: why did this passage sit at rank 3?
 */
import { Link } from "react-router";

import { getRetrievalRun } from "~/lib/api.server";
import type { Route } from "./+types/records.retrievals.$run";

export async function loader({ request, params }: Route.LoaderArgs) {
  return { run: await getRetrievalRun(request, params.run) };
}

export default function RetrievalRunDetail({ loaderData }: Route.ComponentProps) {
  const { run } = loaderData;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link className="underline" to="/records/retrievals">
            ← all retrieval runs
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">“{run.query}”</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(run.createdAt).toLocaleString()} · origin {run.origin} · config{" "}
          {run.config.configName} ({run.config.fusion}) · embedded by {run.embedding.provider}/
          {run.embedding.model}@{run.embedding.dimensions}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="timings">
          {Object.entries(run.timings)
            .map(([stage, ms]) => (ms === null ? `${stage} —` : `${stage} ${ms}ms`))
            .join(" · ")}
        </p>
      </header>

      {run.results.length === 0 ? (
        <p className="text-muted-foreground">This search returned nothing — recorded honestly.</p>
      ) : (
        <ol className="space-y-4">
          {run.results.map((result) => (
            <li key={result.rank} className="rounded-md border p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{result.rank}</span>
                {result.superseded && (
                  <span
                    data-testid="superseded-badge"
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900"
                    title="No current-generation passage carries this text anymore; this snapshot is the durable copy."
                  >
                    superseded
                  </span>
                )}
                {result.prerankPosition !== null && (
                  <span>fused #{result.prerankPosition} before rerank</span>
                )}
              </div>
              <p className="whitespace-pre-wrap">{result.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <Link className="underline" to={`/library/uploads/source/${result.sourceId}`}>
                  view source
                </Link>
                <span>
                  {[
                    result.scores.fts !== null ? `text ${result.scores.fts.toFixed(3)}` : null,
                    result.scores.vector !== null ? `vector ${result.scores.vector.toFixed(3)}` : null,
                    `fused ${result.scores.fused.toFixed(4)}`,
                    result.scores.rerank !== null ? `rerank ${result.scores.rerank.toFixed(3)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
