import { ArrowLeft, Quote, SearchCheck } from "lucide-react";

import type { Route } from "./+types/retrieval-trace";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid, JsonCard } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { getRetrievalTraceInspection } from "~/lib/inspection.server";

function scoreDetailForChunk(scores: unknown, chunkId: string): string {
  if (!Array.isArray(scores)) {
    return "score — · rank —";
  }

  const match = scores.find((score): score is { chunkId: string; score?: unknown; rank?: unknown } => (
    Boolean(score) &&
    typeof score === "object" &&
    "chunkId" in score &&
    score.chunkId === chunkId
  ));

  if (!match) {
    return "score — · rank —";
  }

  return `score ${String(match.score ?? "—")} · rank ${String(match.rank ?? "—")}`;
}

export const meta: Route.MetaFunction = () => [
  { title: "Retrieval trace · Ikis" },
  { name: "description", content: "Inspect query, retrieved chunk IDs, scores, answer model, and final citations." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const inspection = getRetrievalTraceInspection(params.retrievalRunId);

  if (!inspection) {
    throw new Response("Retrieval run not found.", { status: 404 });
  }

  return { inspection };
}

export default function RetrievalTrace({ loaderData }: Route.ComponentProps) {
  const { run, message, citations } = loaderData.inspection;
  const conversationHref = run.conversationId ? `/chat?conversationId=${encodeURIComponent(run.conversationId)}` : "/chat";

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-5xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="relative">
            <Badge>Retrieval trace</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              Trace {run.id}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              Query, retrieved chunk IDs, scores, prompt context hash, answer model, and citations from persisted conversation rows.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href={conversationHref}><ArrowLeft className="h-4 w-4" />Back to chat</a>
            </Button>
          </div>
        </div>

        <Card data-testid="retrieval-trace">
          <CardHeader>
            <SearchCheck className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Answer provenance</CardTitle>
          </CardHeader>
          <DetailGrid items={[
            { label: "Query", value: run.query },
            { label: "Retrieval run ID", value: run.id },
            { label: "Retrieval mode", value: run.retrievalMode },
            { label: "Answer model", value: message?.model },
            { label: "Prompt/version", value: run.modelInputs && typeof run.modelInputs === "object" && !Array.isArray(run.modelInputs) && "promptVersion" in run.modelInputs ? String(run.modelInputs.promptVersion) : "—" },
            { label: "Prompt context hash", value: run.promptContextHash },
            { label: "Source IDs", value: run.modelInputs && typeof run.modelInputs === "object" && !Array.isArray(run.modelInputs) && "sourceIds" in run.modelInputs && Array.isArray(run.modelInputs.sourceIds) ? run.modelInputs.sourceIds.join(", ") : "—" },
            { label: "No evidence", value: run.noEvidence ? "yes" : "no" },
            { label: "Message ID", value: run.messageId },
            { label: "Conversation ID", value: run.conversationId },
            { label: "Corpus ID", value: run.corpusId },
            { label: "Created", value: run.createdAt },
          ]} />
          <blockquote className="mt-5 whitespace-pre-wrap rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 text-sm leading-7 text-[var(--color-card-foreground)]">
            {run.finalAnswer ?? "No final answer stored."}
          </blockquote>
        </Card>

        <Card>
          <CardHeader>
            <Quote className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Retrieved chunks</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3" data-testid="retrieved-chunk-list">
            {run.retrievedChunks.length > 0 ? run.retrievedChunks.map((chunkId) => (
              <div key={chunkId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-card-foreground)]">chunk {chunkId}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em]">{scoreDetailForChunk(run.scores, chunkId)}</p>
              </div>
            )) : <CardContent>No chunks were retrieved for this run.</CardContent>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <Quote className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Final citations</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3">
            {citations.length > 0 ? citations.map((citation) => (
              <a key={citation.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]" href={run.conversationId ? `/chat/${encodeURIComponent(run.conversationId)}/sources/${encodeURIComponent(citation.id)}` : "#"}>
                <span className="font-semibold text-[var(--color-card-foreground)]">[{citation.ordinal + 1}] {citation.document?.title ?? citation.documentId}</span>
                <span className="mt-2 block">chunk {citation.chunkId} · document {citation.documentId} · source {citation.source?.originalFilename ?? citation.sourceId}</span>
                <span className="mt-2 block">{citation.quote}</span>
                <span className="mt-2 block text-xs uppercase tracking-[0.16em]">score {citation.metadata && typeof citation.metadata === "object" && !Array.isArray(citation.metadata) && "score" in citation.metadata ? String(citation.metadata.score) : "—"} · citation {citation.id}</span>
              </a>
            )) : <CardContent>No citations were persisted for this retrieval run.</CardContent>}
          </div>
        </Card>

        <JsonCard title="Retrieved chunk IDs" value={run.retrievedChunks} />
        <JsonCard title="Scores" value={run.scores} />
        <JsonCard title="Model inputs" value={run.modelInputs} />
      </section>
    </main>
  );
}
