import { AlertTriangle, ArrowLeft, FileStack, LinkIcon, RouteIcon } from "lucide-react";
import { useEffect } from "react";
import { useRevalidator } from "react-router";

import type { Route } from "./+types/import-detail";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid, JsonCard } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { formatEasternTime } from "~/lib/display-time";
import { getDerivedImportEvents, getImportJobObservability, isImportJobRunning } from "~/lib/import-observability";
import { getImportInspection } from "~/lib/inspection.server";

export const meta: Route.MetaFunction = () => [
  { title: "Import inspection · Ikis" },
  { name: "description", content: "Inspect import job status, adapter, warnings, errors, and source hash." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const inspection = getImportInspection(params.importJobId);

  if (!inspection) {
    throw new Response("Import job not found.", { status: 404 });
  }

  return { inspection };
}

export default function ImportDetail({ loaderData }: Route.ComponentProps) {
  const { job, source, documents, reviewItems, events: persistedEvents } = loaderData.inspection;
  const observability = getImportJobObservability(job);
  const events = persistedEvents.length > 0 ? persistedEvents : getDerivedImportEvents(job);
  const eventSourceLabel = persistedEvents.length > 0
    ? "Persisted worker/import events from SQLite."
    : "Derived from import job timestamps, warnings, and errors because this job has no persisted events yet.";
  const revalidator = useRevalidator();
  const isActive = isImportJobRunning(job);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const interval = window.setInterval(() => revalidator.revalidate(), 5000);
    return () => window.clearInterval(interval);
  }, [isActive, revalidator]);

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-5xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="relative">
            <Badge>Import audit surface</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              Import {job.id}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              Canonical import status, parser provenance, warnings, errors, and source hash from SQLite.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href="/imports"><ArrowLeft className="h-4 w-4" />Back to imports</a>
            </Button>
          </div>
        </div>

        <Card data-testid="import-inspection">
          <CardHeader>
            <FileStack className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Import job</CardTitle>
          </CardHeader>
          <DetailGrid items={[
            { label: "Import job ID", value: job.id },
            { label: "Corpus ID", value: job.corpusId },
             { label: "Status", value: job.status },
            { label: "Elapsed", value: observability.elapsedLabel },
            { label: "Last update", value: observability.lastUpdatedLabel },
            { label: "Stalled hint", value: observability.staleHint ?? "No stale running state detected." },
            { label: "Adapter", value: job.adapter },
            { label: "Adapter version", value: job.adapterVersion },
            { label: "Source ID", value: source ? <a className="underline decoration-[var(--color-border)] underline-offset-4" href={`/sources/${encodeURIComponent(source.id)}`}>{source.id}</a> : "—" },
            { label: "Source filename", value: source?.originalFilename },
            { label: "Source hash", value: source?.fileHash },
            { label: "Source kind", value: source?.sourceKind },
            { label: "Source MIME", value: source?.mimeType },
            { label: "Source bytes", value: source?.sizeBytes },
            { label: "Source parser", value: source ? `${source.parserAdapter} @ ${source.parserVersion}` : "—" },
            { label: "Source status", value: source?.importStatus },
            { label: "Source version", value: source?.version },
            { label: "Supersedes source", value: source?.supersedesSourceId },
            { label: "Storage URI", value: source?.storageUri },
            { label: "Started", value: formatEasternTime(job.startedAt) },
            { label: "Finished", value: formatEasternTime(job.finishedAt) },
            { label: "Created", value: formatEasternTime(job.createdAt) },
            { label: "Updated", value: formatEasternTime(job.updatedAt) },
          ]} />
          <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-muted-foreground)]">
              <span className="font-semibold text-[var(--color-card-foreground)]">{observability.statusLabel}</span>
              <span>{observability.isRunning ? "Running" : "Recorded"} · {observability.elapsedLabel}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${observability.progressPercent}%` }} />
            </div>
            {observability.staleHint ? <p className="mt-3 text-sm font-semibold text-[var(--color-accent)]">{observability.staleHint}</p> : null}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <AlertTriangle className="h-5 w-5 text-[var(--color-accent)]" />
              <CardTitle>Warnings</CardTitle>
            </CardHeader>
            <CardContent>{job.warnings.length > 0 ? job.warnings.join("\n") : "No warnings recorded for this import."}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <AlertTriangle className="h-5 w-5 text-[var(--color-accent)]" />
              <CardTitle>Errors</CardTitle>
            </CardHeader>
            <CardContent>{job.errors.length > 0 ? job.errors.join("\n") : "No errors recorded for this import."}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <RouteIcon className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>{persistedEvents.length > 0 ? "Import event log" : "Derived event timeline"}</CardTitle>
          </CardHeader>
          <CardContent>
            {eventSourceLabel}
          </CardContent>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <p className="font-semibold text-[var(--color-card-foreground)]">{"label" in event ? event.label : event.eventType.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em]">{formatEasternTime("at" in event ? event.at : event.createdAt)}{"progressPct" in event && event.progressPct !== null ? ` · ${event.progressPct}%` : ""}</p>
                <p className="mt-2">{"detail" in event ? event.detail : event.message}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <LinkIcon className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Canonical records created</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {documents.map((document) => (
              <a key={document.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:bg-[var(--color-secondary)]" href={`/documents/${encodeURIComponent(document.id)}`}>
                <span className="font-semibold text-[var(--color-card-foreground)]">{document.title}</span>
                <span className="mt-1 block">document {document.id} · {document.status}</span>
              </a>
            ))}
            {reviewItems.map((item) => (
              <a key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:bg-[var(--color-secondary)]" href={`/review/${encodeURIComponent(item.id)}`}>
                <span className="font-semibold text-[var(--color-card-foreground)]">{item.title}</span>
                <span className="mt-1 block">review item {item.id} · {item.status}</span>
              </a>
            ))}
          </div>
        </Card>

        <JsonCard title="Import stats" value={job.stats} />
        {source ? <JsonCard title="Source metadata" value={source.metadata} /> : null}
      </section>
    </main>
  );
}
