import { MessageSquareQuote, Search, ShieldCheck } from "lucide-react";
import { Form, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/chat";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAuthenticated } from "~/lib/auth.server";
import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository } from "~/lib/corpus/repository";
import { askGroundedQuestion, getConversationTranscript } from "~/lib/conversations/grounded.server";

export const meta: Route.MetaFunction = () => [
  { title: "Grounded chat · Ikis" },
  { name: "description", content: "Ask approved corpus questions with cited source previews." },
];

function getDefaultCorpusId(): string {
  const db = openDatabase();
  runMigrations(db);

  try {
    return createCorpusRepository(db).getOrCreateDefaultCorpus().id;
  } finally {
    closeDatabase(db);
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAuthenticated(request);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const transcript = getConversationTranscript({ conversationId });

  return {
    corpusId: transcript.conversation?.corpusId ?? getDefaultCorpusId(),
    transcript,
  };
}

export async function action({ request }: Route.ActionArgs) {
  requireAuthenticated(request, { api: true });

  const formData = await request.formData();
  const corpusId = String(formData.get("corpusId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "") || null;
  const question = String(formData.get("question") ?? "");

  if (!corpusId || !question.trim()) {
    return { ok: false, message: "Ask a question before sending." };
  }

  const turn = askGroundedQuestion({ corpusId, conversationId, question });

  return {
    ok: true,
    conversationId: turn.conversation.id,
    answer: turn.assistantMessage.content,
    noEvidence: turn.noEvidence,
    citations: turn.sourcePreviews,
  };
}

export default function Chat({ loaderData }: Route.ComponentProps) {
  const { corpusId, transcript } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const conversationId = actionData?.ok ? actionData.conversationId : transcript.conversation?.id;
  const messages = transcript.messages;
  const latestPreviews = (actionData?.ok ? actionData.citations : transcript.sourcePreviews) ?? [];
  const latestAnswer = actionData?.ok ? actionData.answer : null;
  const noEvidence = actionData?.ok ? actionData.noEvidence : transcript.latestRun?.noEvidence;

  return (
    <main className="min-h-screen px-6 py-8 text-[var(--color-foreground)] md:px-10 lg:px-14">
      <section className="mx-auto grid max-w-6xl gap-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-panel)] md:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(166_64%_24%_/_0.16)] blur-3xl" />
          <div className="absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-[hsl(12_82%_48%_/_0.14)] blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge>Grounded conversation</Badge>
              <h1 className="mt-5 font-[var(--font-display)] text-5xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-6xl">
                Ask Ikis
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--color-muted-foreground)]">
                Questions are answered only from approved indexed corpus chunks. If Ikis cannot cite evidence, it says the corpus lacks enough evidence.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" asChild>
                <a href="/review">Review queue</a>
              </Button>
              <Button variant="secondary" asChild>
                <a href="/">Imports</a>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Card className="min-h-[32rem]">
            <CardHeader>
              <MessageSquareQuote className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <div className="mt-5 grid gap-4" data-testid="chat-transcript">
              {messages.length > 0 ? messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user"
                    ? "ml-auto max-w-2xl rounded-3xl bg-[var(--color-primary)] px-5 py-4 text-[var(--color-primary-foreground)]"
                    : "max-w-2xl whitespace-pre-wrap rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 leading-7 text-[var(--color-card-foreground)]"}
                >
                  {message.content}
                </div>
              )) : (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 text-[var(--color-muted-foreground)]">
                  Ask about approved source material after importing and approving documents.
                </div>
              )}
              {latestAnswer ? (
                <div data-testid="chat-answer" className="max-w-2xl whitespace-pre-wrap rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 leading-7 text-[var(--color-card-foreground)]">
                  {latestAnswer}
                </div>
              ) : null}
            </div>
            <Form method="post" className="mt-6 grid gap-3">
              <input type="hidden" name="corpusId" value={corpusId} />
              <input type="hidden" name="conversationId" value={conversationId ?? ""} />
              <label className="grid gap-2 text-sm font-semibold text-[var(--color-card-foreground)]">
                Question
                <textarea
                  data-testid="chat-question"
                  name="question"
                  rows={4}
                  className="resize-none rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-base leading-7 text-[var(--color-card-foreground)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  placeholder="What does the approved corpus say about the chalk mark?"
                />
              </label>
              <Button data-testid="chat-submit" type="submit" disabled={isSubmitting}>
                <Search className="h-4 w-4" />
                {isSubmitting ? "Searching evidence..." : "Ask with citations"}
              </Button>
            </Form>
            {actionData && !actionData.ok ? (
              <p className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[hsl(41_23%_84%_/_0.42)] px-4 py-3 text-sm font-semibold text-[var(--color-card-foreground)]" role="status">
                {actionData.message}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent>
              {noEvidence ? "No citations were created because retrieval found insufficient evidence." : "Each cited answer links back to a persisted chunk/source preview."}
            </CardContent>
            {transcript.latestRun ? (
              <Button className="mt-4" variant="secondary" asChild>
                <a data-testid="retrieval-trace-link" href={`/retrieval/${encodeURIComponent(transcript.latestRun.id)}`}>Inspect retrieval trace</a>
              </Button>
            ) : null}
            <div className="mt-5 grid gap-3" data-testid="citation-list">
              {latestPreviews.length > 0 ? latestPreviews.map((preview) => (
                <a
                  key={preview.citationId}
                  data-testid="citation-link"
                  href={preview.previewUrl}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]"
                >
                  <span className="font-semibold text-[var(--color-card-foreground)]">[{preview.ordinal + 1}] {preview.documentTitle}</span>
                  <span className="mt-2 block">{preview.quote}</span>
                  <span className="mt-2 block text-xs uppercase tracking-[0.16em]">{preview.sourceLabel}</span>
                </a>
              )) : (
                <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">Citations appear after an evidence-backed answer.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
