/**
 * /records/retrievals — every search the system ever ran, newest first
 * (spec 010 US2, Principle V: Records-style, URL-addressable). Each row
 * links to its receipt; paging rides the URL like /library's (bookmarkable
 * pages). Origin distinguishes an operator at /search from the eval
 * harness — same engine, same receipts, honest attribution.
 */
import { Link } from "react-router";

import { listRetrievalRuns } from "~/lib/api.server";
import type { Route } from "./+types/records.retrievals";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const page = await listRetrievalRuns(request, { offset });
  return { page, offset };
}

export default function RetrievalRuns({ loaderData }: Route.ComponentProps) {
  const { page, offset } = loaderData;
  const shownFrom = page.total === 0 ? 0 : offset + 1;
  const shownTo = Math.min(offset + page.items.length, page.total);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Retrieval runs</h1>
        <p className="text-sm text-muted-foreground">
          Every search is a receipt: what was asked, under which configuration, what came back.
        </p>
      </header>

      {page.total === 0 ? (
        <p data-testid="empty-state" className="text-muted-foreground">
          No retrieval runs yet —{" "}
          <Link className="underline" to="/search">
            run a search
          </Link>{" "}
          and it will be recorded here.
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Query</th>
                <th className="py-2 pr-4">Origin</th>
                <th className="py-2 pr-4">Config</th>
                <th className="py-2 pr-4">Results</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((run) => (
                <tr key={run.id} className="border-b align-top">
                  <td className="py-2 pr-4">
                    <Link className="underline underline-offset-4" to={`/records/retrievals/${run.id}`}>
                      {run.query}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{run.origin}</td>
                  <td className="py-2 pr-4">{run.configName}</td>
                  <td className="py-2 pr-4">{run.resultCount}</td>
                  <td className="py-2">{new Date(run.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Showing {shownFrom} – {shownTo} of {page.total}
            </span>
            {offset > 0 && (
              <Link className="underline" to={`?offset=${Math.max(0, offset - page.limit)}`}>
                Newer
              </Link>
            )}
            {shownTo < page.total && (
              <Link className="underline" to={`?offset=${offset + page.limit}`}>
                Older
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
