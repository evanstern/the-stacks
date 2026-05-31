import { ClipboardCheck, Sparkles } from "lucide-react";
import { spawn } from "node:child_process";
import { Form, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/review";
import { AppShell } from "~/components/app-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAuthenticated } from "~/lib/auth.server";
import type { CorpusReadinessState } from "~/lib/imports/adapters/types";
import { getReviewQueue, recordHumanReviewDecision } from "~/lib/review/queue.server";
import type { ReviewDecision } from "~/lib/review/repository";

const decisionMap = {
  approve: "approved",
  reject: "rejected",
  defer: "deferred",
} satisfies Record<string, ReviewDecision["decisionState"]>;

export const meta: Route.MetaFunction = () => [
  { title: "Review queue · ikis.ai" },
  { name: "description", content: "Human-final review queue for imported corpus material." },
];

export async function loader({ request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  return { queue: getReviewQueue() };
}

export async function action({ request }: Route.ActionArgs) {
  requireAuthenticated(request, { api: true });

  const formData = await request.formData();
  const reviewItemId = String(formData.get("reviewItemId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const decisionState = decisionMap[decision as keyof typeof decisionMap];

  if (!reviewItemId || !decisionState) {
    return { ok: false, message: "Choose a review action before submitting." };
  }

  const saved = recordHumanReviewDecision({ reviewItemId, decisionState, actor: "local-admin", syncRetrievability: false });

  startReviewRetrievabilitySync(reviewItemId);

  return { ok: true, message: `Human decision recorded: ${saved.decisionState}.`, reviewItemId: saved.reviewItemId };
}

function startReviewRetrievabilitySync(reviewItemId: string): void {
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/sync-review-retrievability.ts", reviewItemId], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });

  child.on("error", (error) => {
    console.error("[review-indexer] spawn failed", error);
  });
  child.unref();
}

function suggestionLabel(state: string | undefined): string {
  return {
    suggested_approve: "Suggest approve",
    suggested_reject: "Suggest reject",
    suggested_defer: "Suggest defer",
  }[state ?? ""] ?? "No LLM suggestion";
}

type ReviewMetadata = {
  corpusReadiness?: {
    state?: CorpusReadinessState;
    reason?: string;
    reviewRecommendation?: string;
  };
};

function corpusReadinessForMetadata(value: unknown): ReviewMetadata["corpusReadiness"] {
  return value && typeof value === "object" ? (value as ReviewMetadata).corpusReadiness : undefined;
}

function readinessLabel(state: CorpusReadinessState | undefined): string {
  return {
    usable: "Usable text PDF",
    ocr_needed: "OCR needed",
    deferred: "Defer before corpus use",
    rejected: "Reject for corpus use",
  }[state ?? "usable"];
}

export default function ReviewQueue({ loaderData }: Route.ComponentProps) {
  const { queue } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <AppShell>
      <main className="text-[var(--color-foreground)]">
      <section className="mx-auto grid max-w-6xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-[hsl(12_82%_48%_/_0.14)] blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge>Human-final review</Badge>
              <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
                Review queue
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
                LLM suggestions can accelerate triage, but the canonical corpus state only changes when a human approves, rejects, or defers an item here.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <a href="/imports">Back to imports</a>
            </Button>
          </div>
        </div>

        {actionData?.message ? (
          <div
            className="rounded-2xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] px-4 py-3 text-sm font-semibold text-[var(--color-card-foreground)]"
            role="status"
          >
            {actionData.message}
          </div>
        ) : null}

        <div className="grid gap-5" data-testid="review-queue">
          {queue.length > 0 ? (
            queue.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                  <div>
                    <CardHeader>
                      <ClipboardCheck className="h-5 w-5 text-[var(--color-primary)]" />
                      <CardTitle>
                        <a className="underline decoration-[var(--color-border)] underline-offset-4" href={`/review/${encodeURIComponent(item.id)}`}>{item.title}</a>
                      </CardTitle>
                    </CardHeader>
                    <div className="mt-4 space-y-4 leading-7 text-[var(--color-muted-foreground)]">
                      <p>{item.summary ?? "No summary was produced for this import yet."}</p>
                      {corpusReadinessForMetadata(item.metadata) ? (
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                          <p className="text-sm font-semibold text-[var(--color-card-foreground)]">
                            Corpus readiness: {readinessLabel(corpusReadinessForMetadata(item.metadata)?.state)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
                            {corpusReadinessForMetadata(item.metadata)?.reason}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
                            recommended action: {corpusReadinessForMetadata(item.metadata)?.reviewRecommendation}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-card-foreground)]">
                          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                          {suggestionLabel(item.latestSuggestion?.suggestionState)}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
                          {item.latestSuggestion?.rationale ?? "Suggestion unavailable. Manual review remains available."}
                        </p>
                        {item.latestSuggestion ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">
                            suggestion {item.latestSuggestion.id} · {item.latestSuggestion.model} · {item.latestSuggestion.promptVersion}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Form method="post" className="grid content-start gap-3 rounded-3xl border border-[var(--color-border)] bg-[hsl(39_45%_96%_/_0.58)] p-4">
                    <input type="hidden" name="reviewItemId" value={item.id} />
                    <p className="text-sm font-semibold text-[var(--color-card-foreground)]">Final human decision</p>
                    <Button data-testid="review-approve" type="submit" name="decision" value="approve" disabled={isSubmitting}>
                      Approve
                    </Button>
                    <Button data-testid="review-reject" variant="secondary" type="submit" name="decision" value="reject" disabled={isSubmitting}>
                      Reject
                    </Button>
                    <Button data-testid="review-defer" variant="secondary" type="submit" name="decision" value="defer" disabled={isSubmitting}>
                      Defer
                    </Button>
                    <p className="text-xs leading-5 text-[var(--color-muted-foreground)]">Current state: {item.status}</p>
                    <Button variant="secondary" asChild>
                      <a href={`/review/${encodeURIComponent(item.id)}`}>Inspect history</a>
                    </Button>
                  </Form>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <ClipboardCheck className="h-5 w-5 text-[var(--color-primary)]" />
                <CardTitle>No pending review items</CardTitle>
              </CardHeader>
              <CardContent>Import a Markdown, text, EPUB, MOBI, PDF, or DOCX source to create a human-final review item.</CardContent>
            </Card>
          )}
        </div>
      </section>
      </main>
    </AppShell>
  );
}
