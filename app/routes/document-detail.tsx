import { ArrowLeft, FileText, Rows3 } from "lucide-react";

import type { Route } from "./+types/document-detail";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid, JsonCard } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { formatEasternTime } from "~/lib/display-time";
import { getDocumentInspection } from "~/lib/inspection.server";

export const meta: Route.MetaFunction = () => [
  { title: "Document preview · Ikis" },
  { name: "description", content: "Inspect normalized document text, sections, chunks, and source provenance." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const inspection = getDocumentInspection(params.documentId);

  if (!inspection) {
    throw new Response("Document not found.", { status: 404 });
  }

  return { inspection };
}

export default function DocumentDetail({ loaderData }: Route.ComponentProps) {
  const { document, source, sections, chunks } = loaderData.inspection;

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-5xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="relative">
            <Badge>Document and chunk preview</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              {document.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              Preview normalized text, parser provenance, section boundaries, and retrievable chunks without changing canonical state.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href="/"><ArrowLeft className="h-4 w-4" />Back to imports</a>
            </Button>
          </div>
        </div>

        <Card data-testid="document-inspection">
          <CardHeader>
            <FileText className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Document record</CardTitle>
          </CardHeader>
          <DetailGrid items={[
            { label: "Document ID", value: document.id },
            { label: "Corpus ID", value: document.corpusId },
            { label: "Status", value: document.status },
            { label: "Source ID", value: document.sourceId },
            { label: "Source filename", value: source?.originalFilename },
            { label: "Source hash", value: source?.fileHash },
            { label: "Source parser", value: source ? `${source.parserAdapter} @ ${source.parserVersion}` : "—" },
            { label: "Format", value: document.sourceFormat },
            { label: "Authors", value: document.authors.length > 0 ? document.authors.join(", ") : "—" },
            { label: "Language", value: document.language },
            { label: "Content hash", value: document.contentHash },
            { label: "Sections", value: sections.length },
            { label: "Chunks", value: chunks.length },
            { label: "Created", value: formatEasternTime(document.createdAt) },
            { label: "Updated", value: formatEasternTime(document.updatedAt) },
          ]} />
          <blockquote className="mt-5 max-h-96 overflow-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 text-sm leading-7 text-[var(--color-card-foreground)]">
            {document.normalizedText}
          </blockquote>
        </Card>

        <Card>
          <CardHeader>
            <Rows3 className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Chunks</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3">
            {chunks.length > 0 ? chunks.map((chunk) => (
              <div key={chunk.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-card-foreground)]">chunk {chunk.id}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em]">stable {chunk.stableId} · section {chunk.sectionId ?? "—"} · offsets {chunk.startOffset}-{chunk.endOffset} · hash {chunk.contentHash}</p>
                {chunk.headingPath.length > 0 ? <p className="mt-2">{chunk.headingPath.join(" / ")}</p> : null}
                <p className="mt-3 text-[var(--color-card-foreground)]">{chunk.text}</p>
              </div>
            )) : <CardContent>No chunks have been created for this document yet.</CardContent>}
          </div>
        </Card>

        <JsonCard title="Document provenance" value={document.provenance} />
        <JsonCard title="Raw metadata" value={document.rawMetadata} />
        <JsonCard title="Sections" value={sections.map((section) => ({ id: section.id, heading: section.heading, headingPath: section.headingPath, offsets: [section.startOffset, section.endOffset], metadata: section.metadata }))} />
      </section>
    </main>
  );
}
