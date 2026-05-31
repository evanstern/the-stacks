import { ArrowLeft, ClipboardCheck, Sparkles, UserCheck, Workflow } from "lucide-react";

import type { Route } from "./+types/review-detail";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DetailGrid, JsonCard } from "~/components/inspection/detail-grid";
import { requireAuthenticated } from "~/lib/auth.server";
import { formatEasternTime } from "~/lib/display-time";
import { getReviewInspection } from "~/lib/inspection.server";

export const meta: Route.MetaFunction = () => [
  { title: "Review history · Ikis" },
  { name: "description", content: "Inspect review suggestions separately from human decisions." },
];

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const inspection = getReviewInspection(params.reviewItemId);

  if (!inspection) {
    throw new Response("Review item not found.", { status: 404 });
  }

  return { inspection };
}

export default function ReviewDetail({ loaderData }: Route.ComponentProps) {
  const { item, suggestions, decisions, workflowRuns, source, document } = loaderData.inspection;

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-5xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="relative">
            <Badge>Review audit trail</Badge>
            <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
              {item.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
              LLM suggestions are advisory records; human decisions are listed separately as the canonical review state.
            </p>
            <Button className="mt-6" variant="secondary" asChild>
              <a href="/review"><ArrowLeft className="h-4 w-4" />Back to review queue</a>
            </Button>
          </div>
        </div>

        <Card data-testid="review-inspection">
          <CardHeader>
            <ClipboardCheck className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Review item</CardTitle>
          </CardHeader>
          <DetailGrid items={[
            { label: "Review item ID", value: item.id },
            { label: "Corpus ID", value: item.corpusId },
            { label: "Status", value: item.status },
            { label: "Target type", value: item.targetType },
            { label: "Target ID", value: item.targetId },
            { label: "Document", value: document ? <a className="underline decoration-[var(--color-border)] underline-offset-4" href={`/documents/${encodeURIComponent(document.id)}`}>{document.title}</a> : "—" },
            { label: "Source", value: source?.originalFilename },
            { label: "Source ID", value: source?.id },
            { label: "Created", value: formatEasternTime(item.createdAt) },
            { label: "Updated", value: formatEasternTime(item.updatedAt) },
          ]} />
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
            <CardTitle>LLM suggestions</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3">
            {suggestions.length > 0 ? suggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-card-foreground)]">{suggestion.suggestionState}</p>
                <p className="mt-2">{suggestion.rationale}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em]">suggestion {suggestion.id} · model {suggestion.model} · prompt {suggestion.promptVersion} · confidence {suggestion.confidence ?? "—"} · created {formatEasternTime(suggestion.createdAt)}</p>
                <pre className="mt-3 max-h-48 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] p-3 text-xs leading-5">
                  {JSON.stringify(suggestion.metadata, null, 2)}
                </pre>
              </div>
            )) : <CardContent>No LLM suggestions are stored for this review item.</CardContent>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <UserCheck className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Human decisions</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3">
            {decisions.length > 0 ? decisions.map((decision) => (
              <div key={decision.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-card-foreground)]">{decision.decisionState}</p>
                <p className="mt-2">Actor {decision.actor} · decided {decision.decidedAt}</p>
                <p className="mt-2">{decision.rationale ?? "No human rationale recorded."}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em]">decision {decision.id} · source suggestion {decision.suggestionId ?? "none"}</p>
                <pre className="mt-3 max-h-48 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] p-3 text-xs leading-5">
                  {JSON.stringify(decision.metadata, null, 2)}
                </pre>
              </div>
            )) : <CardContent>No human decision has been recorded yet.</CardContent>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <Workflow className="h-5 w-5 text-[var(--color-primary)]" />
            <CardTitle>Workflow runs</CardTitle>
          </CardHeader>
          <div className="mt-4 grid gap-3">
            {workflowRuns.length > 0 ? workflowRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-card-foreground)]">{run.workflowKind} · {run.status}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em]">thread {run.threadId} · workflow {run.id}</p>
                <p className="mt-2">target {run.targetType ?? "—"} · {run.targetId ?? "—"}</p>
              </div>
            )) : <CardContent>No workflow run is attached to this review item.</CardContent>}
          </div>
        </Card>

        <JsonCard title="Review metadata" value={item.metadata} />
      </section>
    </main>
  );
}
