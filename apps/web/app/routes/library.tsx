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
 * The Evidence column (US3) makes the listing an operator dashboard: plugin
 * attribution + generation + current-generation counts on sources, a scrubbed
 * failed-at-stage line on failures, entry-outcome summaries on batches —
 * SC-003's "what succeeded, what failed, how much is indexed" without opening
 * a single detail page.
 */
import { Link } from "react-router";

import type { LibraryListItem } from "~/lib/api.server";
import { listUploads } from "~/lib/api.server";
import type { Route } from "./+types/library";

/** The per-row evidence cell — one component per kind's story (US3). */
function Evidence({ item }: { item: LibraryListItem }) {
  if (item.kind === "batch") {
    const { ingested, skipped, failed, total } = item.entrySummary;
    return (
      <span>
        {total} entries: {ingested} ingested · {skipped} skipped ·{" "}
        <span className={failed > 0 ? "text-destructive" : ""}>{failed} failed</span>
      </span>
    );
  }
  if (item.lastError) {
    // The scrubbed why, one glance deep — full trail stays on the detail page.
    return (
      <span className="text-destructive">
        failed at {item.lastError.stage} ({item.lastError.class})
      </span>
    );
  }
  if (!item.plugin) {
    return <span className="text-muted-foreground">awaiting detect</span>;
  }
  return (
    <span>
      {item.plugin.name}@{item.plugin.version} · gen {item.generation} · {item.counts.sections}{" "}
      sections · {item.counts.chunks} passages
    </span>
  );
}

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
              <th className="py-2 pr-4">Evidence</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const failed =
                item.status === "failed" || (item.kind === "batch" && item.entrySummary.failed > 0);
              return (
                <tr
                  key={`${item.kind}/${item.id}`}
                  className="border-b"
                  data-testid="library-row"
                  data-failed={failed ? "true" : "false"}
                >
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
                  <td className={`py-2 pr-4 ${item.status === "failed" ? "text-destructive" : ""}`}>
                    {item.status}
                  </td>
                  <td className="py-2 pr-4">
                    <Evidence item={item} />
                  </td>
                  <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
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
