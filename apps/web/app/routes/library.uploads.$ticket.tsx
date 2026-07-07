/**
 * /library/uploads/:kind/:id — the "watch it finish" half of the upload flow
 * (008 FR-027/FR-010, US2). Renders a claim ticket's status and its full
 * append-only stage trail, auto-revalidating every 1.5s while non-terminal —
 * the same loader-revalidation polling as skeleton-check-detail.tsx, and for
 * the same reason: the browser never calls the API (007 FR-019).
 *
 * Failures render the SCRUBBED lastError (class + stage + message) — the
 * operator sees an honest why; full diagnostics stay operator-side in the
 * trail's detail and the logs (Principle IV).
 */
import { useEffect } from "react";
import { Link, useRevalidator } from "react-router";

import { getUploadTicket } from "~/lib/api.server";
import type { Route } from "./+types/library.uploads.$ticket";

// Terminal per ticket kind: nothing about the record can change after these.
const TERMINAL = new Set(["ingested", "failed", "empty", "expanded"]);

export async function loader({ request, params }: Route.LoaderArgs) {
  const detail = await getUploadTicket(request, params.kind!, params.id!);
  if (!detail) {
    throw new Response("Not found", { status: 404 });
  }
  return { detail };
}

export default function UploadTicket({ loaderData }: Route.ComponentProps) {
  const detail = loaderData?.detail;
  const revalidator = useRevalidator();

  const status =
    detail && "source" in detail ? detail.source.status : detail ? detail.batch.status : undefined;

  useEffect(() => {
    if (!status || TERMINAL.has(status)) {
      return;
    }
    const interval = setInterval(() => revalidator.revalidate(), 1500);
    return () => clearInterval(interval);
  }, [status, revalidator]);

  if (!detail) {
    return null;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">
        Upload {detail.ticket.kind}/{detail.ticket.id.slice(0, 8)}…
      </h1>

      {"source" in detail ? (
        <section className="space-y-2 text-sm" data-testid="source-status">
          <p>
            <span className="font-mono">{detail.source.originalFilename}</span> — status:{" "}
            <strong>{detail.source.status}</strong>
          </p>
          {detail.source.plugin && (
            <p>
              Ingester: {detail.source.plugin.name}@{detail.source.plugin.version} (confidence{" "}
              {detail.source.plugin.confidence.toFixed(2)})
            </p>
          )}
          {detail.source.status === "ingested" && (
            <p>
              Generation {detail.source.generation}: {detail.source.counts.sections} sections,{" "}
              {detail.source.counts.chunks} indexed passages.
            </p>
          )}
          {detail.source.lastError && (
            <p className="rounded border border-destructive p-2" data-testid="last-error">
              Failed at <strong>{detail.source.lastError.stage}</strong> (
              {detail.source.lastError.class}): {detail.source.lastError.message}
            </p>
          )}
        </section>
      ) : (
        <section className="space-y-2 text-sm" data-testid="batch-status">
          <p>
            <span className="font-mono">{detail.batch.originalFilename}</span> — status:{" "}
            <strong>{detail.batch.status}</strong>
          </p>
          {detail.batch.entryReport.length > 0 && (
            <ul className="list-disc pl-5">
              {detail.batch.entryReport.map((entry) => (
                <li key={entry.name}>
                  <span className="font-mono">{entry.name}</span>: {entry.outcome}
                  {entry.reason ? ` — ${entry.reason}` : ""}{" "}
                  {entry.sourceId && (
                    <Link className="underline" to={`/library/uploads/source/${entry.sourceId}`}>
                      view
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium">Event trail</h2>
        {/* The append-only history, retries included — what happened, in
            order, straight from ingestion_events (US2 AC-1/AC-3). */}
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="pr-4">Stage</th>
              <th className="pr-4">Event</th>
              <th className="pr-4">OK</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody data-testid="event-trail">
            {detail.events.map((event, index) => (
              <tr key={index} className={event.ok ? "" : "text-destructive"}>
                <td className="pr-4 font-mono">{event.stage}</td>
                <td className="pr-4">{event.event}</td>
                <td className="pr-4">{event.ok ? "✓" : "✗"}</td>
                <td>{event.durationMs != null ? `${event.durationMs} ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-sm">
        <Link className="underline" to="/library/upload">
          Upload more
        </Link>
      </p>
    </main>
  );
}
