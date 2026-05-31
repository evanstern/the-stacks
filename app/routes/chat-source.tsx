import { ArrowLeft, FileText } from "lucide-react";

import type { Route } from "./+types/chat-source";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { getCitationSourcePreview } from "~/lib/conversations/grounded.server";
import { getRetrievalTraceInspection } from "~/lib/inspection.server";

function promptVersionFromTrace(trace: Awaited<ReturnType<typeof getRetrievalTraceInspection>>): string {
  const modelInputs = trace?.run.modelInputs;

  if (modelInputs && typeof modelInputs === "object" && !Array.isArray(modelInputs) && "promptVersion" in modelInputs) {
    return String(modelInputs.promptVersion);
  }

  return "—";
}

function sourceIdsFromTrace(trace: Awaited<ReturnType<typeof getRetrievalTraceInspection>>): string {
  const modelInputs = trace?.run.modelInputs;

  if (modelInputs && typeof modelInputs === "object" && !Array.isArray(modelInputs) && "sourceIds" in modelInputs && Array.isArray(modelInputs.sourceIds)) {
    return modelInputs.sourceIds.join(", ");
  }

  return previewSourceFallback(trace);
}

function previewSourceFallback(trace: Awaited<ReturnType<typeof getRetrievalTraceInspection>>): string {
  const sourceIds = trace?.citations.flatMap((citation) => citation.sourceId ? [citation.sourceId] : []) ?? [];
  return sourceIds.length > 0 ? Array.from(new Set(sourceIds)).join(", ") : "—";
}

export const meta: Route.MetaFunction = () => [
  { title: "Source preview · Ikis" },
  { name: "description", content: "Preview the chunk and source behind an Ikis citation." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const preview = getCitationSourcePreview({ conversationId: params.conversationId, citationId: params.citationId });

  if (!preview) {
    throw new Response("Citation source preview not found.", { status: 404 });
  }

  const trace = getRetrievalTraceInspection(preview.retrievalRunId);

  return { preview, conversationId: params.conversationId, trace };
}

export default function ChatSourcePreview({ loaderData }: Route.ComponentProps) {
  const { preview, conversationId, trace } = loaderData;

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-4xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="relative">
            <Badge>Persisted source preview</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              Citation [{preview.ordinal + 1}]
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              This preview resolves the citation to its stored chunk, document, and source record.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href={`/chat?conversationId=${encodeURIComponent(conversationId)}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to chat
              </a>
            </Button>
          </div>
        </div>

        <Card data-testid="source-preview">
          <CardHeader>
            <FileText className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>{preview.documentTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.sourceLabel} · chunk {preview.chunkId}
          </CardContent>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Retrieval score</p>
              <p className="mt-2 font-semibold text-[var(--color-card-foreground)]">{preview.score ?? "—"}</p>
            </div>
            <a className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]" href={`/retrieval/${encodeURIComponent(preview.retrievalRunId)}`}>
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Retrieval trace</span>
              <span className="mt-2 block font-semibold text-[var(--color-card-foreground)]">{preview.retrievalRunId}</span>
            </a>
          </div>
          <div className="mt-5">
            <DetailGrid items={[
              { label: "Citation ID", value: preview.citationId },
              { label: "Chunk ID", value: preview.chunkId },
              { label: "Document ID", value: preview.documentId },
              { label: "Source ID", value: preview.sourceId },
              { label: "Source filename", value: preview.sourceLabel },
              { label: "Answer model", value: trace?.message?.model },
              { label: "Prompt version", value: promptVersionFromTrace(trace) },
              { label: "Prompt context hash", value: trace?.run.promptContextHash },
              { label: "Retrieval query", value: trace?.run.query },
              { label: "Source IDs used", value: sourceIdsFromTrace(trace) },
            ]} />
          </div>
          {trace?.message?.model ? (
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
              answer model {trace.message.model} · prompt hash {trace.run.promptContextHash}
            </p>
          ) : null}
          {preview.headingPath.length > 0 ? (
            <p className="mt-4 text-sm uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">{preview.headingPath.join(" / ")}</p>
          ) : null}
          <blockquote className="mt-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 text-lg leading-8 text-[var(--color-card-foreground)]">
            {preview.quote}
          </blockquote>
          <div className="mt-5 rounded-3xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] p-5 text-sm leading-7 text-[var(--color-muted-foreground)]">
            {preview.chunkText}
          </div>
        </Card>
      </section>
    </main>
  );
}
