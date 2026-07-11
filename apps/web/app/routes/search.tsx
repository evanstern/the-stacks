/**
 * /search — the product's reason to exist (spec 010 US1): ask the library a
 * question, get ranked passages with receipts. The query rides the URL
 * (?q=…) so every search is bookmarkable/shareable (Principle V:
 * URL-addressable state) — the loader searches, the form just navigates.
 *
 * Reads through searchLibrary (lib/api.server.ts — the one legal API path,
 * 007 FR-019). Each result shows its passage, source attribution linking to
 * the ticket detail page, and its per-signal scores; the run id links to the
 * receipt (US2's records surface). An empty result set renders an honest
 * empty state — the engine recorded that run too.
 */
import { Form, Link, useNavigation } from "react-router";

import type { SearchResponse, SearchResultItem } from "~/lib/api.server";
import { searchLibrary } from "~/lib/api.server";
import type { Route } from "./+types/search";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length === 0) {
    return { q: "", search: null as SearchResponse | null };
  }
  return { q, search: await searchLibrary(request, q) };
}

function ScoreLine({ scores }: { scores: SearchResultItem["scores"] }) {
  const parts = [
    scores.fts !== null ? `text ${scores.fts.toFixed(3)}` : null,
    scores.vector !== null ? `vector ${scores.vector.toFixed(3)}` : null,
    `fused ${scores.fused.toFixed(4)}`,
    scores.rerank !== null ? `rerank ${scores.rerank.toFixed(3)}` : null,
  ].filter(Boolean);
  return <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, search } = loaderData;
  const navigation = useNavigation();
  const searching = navigation.state === "loading";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Both signals answer: exact terms and meaning matches, fused into one ranking.
        </p>
      </header>

      <Form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="grapple, opportunity attacks, holding an enemy in place…"
          className="w-full rounded-md border px-3 py-2"
          aria-label="Search the library"
          maxLength={1024}
          required
        />
        <button type="submit" className="rounded-md border px-4 py-2" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </Form>

      {search && search.results.length === 0 && (
        <p data-testid="empty-state" className="text-muted-foreground">
          Nothing in the library matches “{search.query}”. Try different words — or{" "}
          <Link className="underline" to="/library/upload">
            upload the material
          </Link>{" "}
          it should come from.
        </p>
      )}

      {search && search.results.length > 0 && (
        <section aria-label="Search results" className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {search.results.length} passage{search.results.length === 1 ? "" : "s"} ·{" "}
            {/* The receipt link: this exact response, replayable (US2). */}
            <Link className="underline" to={`/records/retrievals/${search.runId}`}>
              run receipt
            </Link>
          </p>
          <ol className="space-y-4">
            {search.results.map((result) => (
              <li key={result.chunkId} className="rounded-md border p-4">
                <p className="whitespace-pre-wrap">{result.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link
                    className="text-sm underline underline-offset-4"
                    to={`/library/uploads/source/${result.sourceId}`}
                  >
                    view source
                  </Link>
                  {Array.isArray(result.anchor.headingTrail) &&
                    result.anchor.headingTrail.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {result.anchor.headingTrail.join(" › ")}
                      </span>
                    )}
                  <ScoreLine scores={result.scores} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
