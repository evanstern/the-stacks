/**
 * /library — the operator's inventory of everything they submitted (009 US1,
 * FR-002/003/007/008). This page exists so a lost claim-ticket URL is
 * recoverable from the UI instead of the database: every row links to the
 * ticket detail page 008 built.
 *
 * Reads through listUploads (lib/api.server.ts — the one legal API path,
 * 007 FR-019). No live polling here: the listing reflects reality at
 * load/refresh; the ticket page stays the live-updating surface (spec edge
 * case — one polling surface is enough).
 *
 * US3 (T018) adds the evidence columns (plugin, generation, counts, failure
 * treatment, batch entry summaries) — this file lands US1-bare on purpose.
 */
import { Link } from "react-router";

import { listUploads } from "~/lib/api.server";
import type { Route } from "./+types/library";

export async function loader({ request }: Route.LoaderArgs) {
  // Offset rides the page URL so paging is addressable/bookmarkable
  // (Principle V: URL-addressable state). The API clamps; we only parse.
  const url = new URL(request.url);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const page = await listUploads(request, { offset });
  return { page };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;
  const { items, total, limit, offset } = page;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <Link className="text-sm underline" to="/library/upload">
          Upload
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded border p-6 text-sm" data-testid="library-empty">
          <p>
            Nothing in the library yet.{" "}
            <Link className="underline" to="/library/upload">
              Upload your first document
            </Link>{" "}
            — a saved HTML page, Markdown, plain text, or a ZIP of them.
          </p>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">File</th>
              <th className="py-2 pr-4">Kind</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.kind}/${item.id}`} className="border-b" data-testid="library-row">
                <td className="py-2 pr-4">
                  {/* The filename IS the link: the row's whole reason to exist
                      is the way back to its ticket page (FR-003). */}
                  <Link
                    className="font-mono underline"
                    to={`/library/uploads/${item.kind}/${item.id}`}
                  >
                    {item.originalFilename}
                  </Link>
                </td>
                <td className="py-2 pr-4">{item.kind}</td>
                <td className="py-2 pr-4">{item.status}</td>
                <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {total > 0 && (
        <div className="flex items-center gap-4 text-sm" data-testid="library-paging">
          <span>
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          {offset > 0 && (
            <Link className="underline" to={`/library?offset=${Math.max(0, offset - limit)}`}>
              Newer
            </Link>
          )}
          {offset + limit < total && (
            <Link className="underline" to={`/library?offset=${offset + limit}`}>
              Older
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
