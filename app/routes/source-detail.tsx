import { ArrowLeft, FileArchive, FileText, LinkIcon, Rows3 } from "lucide-react";
import { useEffect } from "react";
import { useRevalidator } from "react-router";

import type { Route } from "./+types/source-detail";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid, JsonCard } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { formatEasternTime } from "~/lib/display-time";
import { getImportJobObservability, isImportJobRunning } from "~/lib/import-observability";
import { getSourceInspection } from "~/lib/inspection.server";

export const meta: Route.MetaFunction = () => [
  { title: "Source material · Ikis" },
  { name: "description", content: "Inspect raw source files, normalized documents, sections, chunks, and related import records." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const inspection = getSourceInspection(params.sourceId);

  if (!inspection) {
    throw new Response("Source not found.", { status: 404 });
  }

  return { inspection };
}

export default function SourceDetail({ loaderData }: Route.ComponentProps) {
  const { source, importJobs, documents, reviewItems, rawFile } = loaderData.inspection;
  const revalidator = useRevalidator();
  const hasActiveJobs = importJobs.some(isImportJobRunning);

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const interval = window.setInterval(() => revalidator.revalidate(), 5000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, revalidator]);

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-6xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-[hsl(12_82%_48%_/_0.14)] blur-3xl" />
          <div className="relative">
            <Badge>Source material</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              {source.originalFilename}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              Raw source file metadata, capped text preview where safe, and normalized corpus material from persisted records.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href="/imports"><ArrowLeft className="h-4 w-4" />Back to imports</a>
            </Button>
          </div>
        </div>

        <Card data-testid="source-inspection">
          <CardHeader>
            <FileArchive className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Source record</CardTitle>
          </CardHeader>
          <DetailGrid items={[
            { label: "Source ID", value: source.id },
            { label: "Corpus ID", value: source.corpusId },
            { label: "Status", value: source.importStatus },
            { label: "Kind", value: source.sourceKind },
            { label: "MIME", value: source.mimeType },
            { label: "Bytes", value: source.sizeBytes },
            { label: "Parser", value: `${source.parserAdapter} @ ${source.parserVersion}` },
            { label: "Version", value: source.version },
            { label: "Supersedes", value: source.supersedesSourceId },
            { label: "Storage URI", value: source.storageUri },
            { label: "Created", value: formatEasternTime(source.createdAt) },
            { label: "Updated", value: formatEasternTime(source.updatedAt) },
          ]} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <FileText className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Raw/source file</CardTitle>
            </CardHeader>
            <CardContent>{rawFile.message}</CardContent>
            <DetailGrid items={[
              { label: "Readable", value: rawFile.readable ? "yes" : "no" },
              { label: "File path", value: rawFile.filePath },
              { label: "File bytes", value: rawFile.sizeBytes },
              { label: "Preview capped", value: rawFile.previewTruncated ? "yes" : "no" },
            ]} />
            {rawFile.previewText ? (
              <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-card-foreground)]">
                {rawFile.previewText}
              </pre>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <Rows3 className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Normalized material</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? `${documents.length} document record${documents.length === 1 ? "" : "s"} extracted from this source.` : "No normalized documents have been created for this source yet."}
            </CardContent>
            <div className="mt-4 grid gap-3">
              {documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                  <a className="font-semibold text-[var(--color-card-foreground)] underline decoration-[var(--color-border)] underline-offset-4" href={`/documents/${encodeURIComponent(document.id)}`}>{document.title}</a>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em]">document {document.id} · {document.status} · {document.sections.length} sections · {document.chunks.length} chunks</p>
                  <blockquote className="mt-3 max-h-48 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-[var(--color-card-foreground)]">
                    {document.normalizedText}
                  </blockquote>
                  <div className="mt-3 grid gap-2">
                    {document.sections.slice(0, 6).map((section) => (
                      <a key={section.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 transition-colors hover:bg-[var(--color-secondary)]" href={`/documents/${encodeURIComponent(document.id)}#${encodeURIComponent(section.id)}`}>
                        section {section.ordinal}: {section.heading ?? (section.headingPath.join(" / ") || section.id)}
                      </a>
                    ))}
                    {document.chunks.slice(0, 6).map((chunk) => (
                      <a key={chunk.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 transition-colors hover:bg-[var(--color-secondary)]" href={`/documents/${encodeURIComponent(document.id)}#${encodeURIComponent(chunk.id)}`}>
                        chunk {chunk.ordinal}: {chunk.stableId}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <LinkIcon className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Related records</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--color-muted-foreground)] md:grid-cols-2">
            {importJobs.map((job) => {
              const observability = getImportJobObservability(job);
              return (
                <a key={job.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:bg-[var(--color-secondary)]" href={`/imports/${encodeURIComponent(job.id)}`}>
                  <span className="font-semibold text-[var(--color-card-foreground)]">Import {job.id}</span>
                  <span className="mt-1 block">{observability.statusLabel} · {job.adapter} · elapsed {observability.elapsedLabel}</span>
                  <span className="mt-1 block text-xs uppercase tracking-[0.16em]">{job.events.length} event{job.events.length === 1 ? "" : "s"}</span>
                </a>
              );
            })}
            {documents.map((document) => (
              <a key={document.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:bg-[var(--color-secondary)]" href={`/documents/${encodeURIComponent(document.id)}`}>
                <span className="font-semibold text-[var(--color-card-foreground)]">{document.title}</span>
                <span className="mt-1 block">document {document.id} · {document.status}</span>
              </a>
            ))}
            {reviewItems.map((item) => (
              <a key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 transition-colors hover:bg-[var(--color-secondary)]" href={`/review/${encodeURIComponent(item.id)}`}>
                <span className="font-semibold text-[var(--color-card-foreground)]">{item.title}</span>
                <span className="mt-1 block">review {item.id} · {item.targetType} · {item.status}</span>
              </a>
            ))}
          </div>
        </Card>

        <JsonCard title="Source metadata" value={source.metadata} />
      </section>
    </main>
  );
}
