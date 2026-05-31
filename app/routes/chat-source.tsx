import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router";

import type { Route } from "./+types/chat-source";
import { MarkdownContent } from "~/components/chat/markdown-content";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireAuthenticated } from "~/lib/auth.server";
import { getCitationSourcePreview } from "~/lib/conversations/grounded.server";
import { getRetrievalTraceInspection } from "~/lib/inspection.server";
import { tokenizeQuery } from "~/lib/retrieval/lexical";

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

  const highlightTerms = trace ? tokenizeQuery(trace.run.query) : [];

  return { preview, conversationId: params.conversationId, highlightTerms, trace };
}

export default function ChatSourcePreview({ loaderData }: Route.ComponentProps) {
  const { preview, conversationId, highlightTerms, trace } = loaderData;
  const detailItems = [
    { label: "Citation", value: preview.citationId },
    { label: "Chunk", value: preview.chunkId },
    { label: "Document", value: preview.documentId },
    { label: "Source", value: preview.sourceId },
    { label: "Prompt", value: promptVersionFromTrace(trace) },
    { label: "Sources used", value: sourceIdsFromTrace(trace) },
  ];

  return (
    <article data-testid="source-preview" className="mb-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge>Opened source</Badge>
          <div className="mt-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="font-[var(--font-display)] text-2xl font-bold tracking-[-0.02em] text-[var(--color-card-foreground)]">
              Citation [{preview.ordinal + 1}]
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {preview.documentTitle} · {preview.sourceLabel}
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link to={`/chat/${encodeURIComponent(conversationId)}`}>
            <ArrowLeft className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]">Retrieval score</p>
          <p className="mt-2 font-semibold text-[var(--color-card-foreground)]">{preview.score ?? "—"}</p>
        </div>
        <Link className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]" to={`/retrieval/${encodeURIComponent(preview.retrievalRunId)}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">Retrieval trace</span>
          <span className="mt-2 block truncate font-semibold text-[var(--color-card-foreground)]">{preview.retrievalRunId}</span>
        </Link>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        {detailItems.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">{item.label}</dt>
            <dd className="mt-1 break-words font-semibold leading-5 text-[var(--color-card-foreground)]">{item.value}</dd>
          </div>
        ))}
      </dl>

      {trace?.message?.model ? (
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
          answer model {trace.message.model} · prompt hash {trace.run.promptContextHash}
        </p>
      ) : null}
      {preview.headingPath.length > 0 ? (
        <p className="mt-4 text-sm uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">{preview.headingPath.join(" / ")}</p>
      ) : null}
      <blockquote className="mt-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-base leading-7 text-[var(--color-card-foreground)]">
        <MarkdownContent highlightTerms={highlightTerms}>{preview.quote}</MarkdownContent>
      </blockquote>
      <div className="mt-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-notice)] p-5 text-sm leading-7 text-[var(--color-card-foreground)]">
        <MarkdownContent highlightTerms={highlightTerms}>{preview.chunkText}</MarkdownContent>
      </div>
    </article>
  );
}
