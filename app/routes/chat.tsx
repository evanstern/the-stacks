import { BookOpenText, Library, MessageSquareQuote, Moon, Search, Scale, ShieldCheck, Sun, UploadCloud } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Form, Link, NavLink, Outlet, redirect, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/chat";
import { MarkdownContent } from "~/components/chat/markdown-content";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAuthenticated } from "~/lib/auth.server";
import { createCorpusRepository } from "~/lib/corpus/repository";
import { askGroundedQuestion, getConversationTranscript } from "~/lib/conversations/grounded.server";
import { createConversationRepository } from "~/lib/conversations/repository";
import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { cn } from "~/lib/utils";

type ThemePreference = "light" | "dark";

const compactNavItems = [
  { label: "Chat", href: "/", icon: MessageSquareQuote, end: true },
  { label: "Imports", href: "/imports", icon: UploadCloud, end: false },
  { label: "Review", href: "/review", icon: Scale, end: false },
];

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

function listRecentConversations() {
  const db = openDatabase();
  runMigrations(db);

  try {
    return createConversationRepository(db).listConversations({ limit: 10 });
  } finally {
    closeDatabase(db);
  }
}

function formatSessionLabel(title: string | null, id: string): string {
  return title?.trim() || id;
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme;
}

function getConversationIdParam(params: Record<string, string | undefined>): string | undefined {
  return "conversationId" in params && typeof params.conversationId === "string" ? params.conversationId : undefined;
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("light");

  useEffect(() => {
    const documentTheme = document.documentElement.dataset.theme;
    const storedTheme = localStorage.getItem("ikis-theme");
    const nextTheme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : documentTheme === "dark"
        ? "dark"
        : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem("ikis-theme", nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-card-foreground)] shadow-sm transition-colors hover:bg-[var(--color-secondary)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

export async function loader(args: Route.LoaderArgs) {
  const { request } = args;
  requireAuthenticated(request);

  const url = new URL(request.url);
  const params = "params" in args ? args.params : {};
  const conversationId = getConversationIdParam(params) ?? url.searchParams.get("conversationId");
  const transcript = getConversationTranscript({ conversationId });

  return {
    activeConversationId: conversationId,
    conversations: listRecentConversations(),
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

  const turn = await askGroundedQuestion({ corpusId, conversationId, question });

  throw redirect(`/chat/${encodeURIComponent(turn.conversation.id)}`);
}

export default function Chat({ loaderData }: Route.ComponentProps) {
  const { activeConversationId, conversations, corpusId, transcript } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const conversationId = transcript.conversation?.id ?? activeConversationId;
  const messages = transcript.messages;
  const latestPreviews = transcript.sourcePreviews ?? [];
  const previewsByMessageId = transcript.sourcePreviewsByMessageId ?? {};
  const noEvidence = transcript.latestRun?.noEvidence;
  const formAction = conversationId ? `/chat/${encodeURIComponent(conversationId)}` : "/chat";
  const latestMessageId = messages[messages.length - 1]?.id;
  const transcriptScrollKey = `${conversationId ?? "new"}:${latestMessageId ?? messages.length}`;
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState("");
  const [questionCursor, setQuestionCursor] = useState<number | null>(null);

  useEffect(() => {
    if (navigation.state === "submitting" && navigation.formData?.has("question")) {
      setQuestion("");
    }
  }, [navigation.formData, navigation.state]);

  useEffect(() => {
    if (!conversationId) {
      setQuestion("");
      return;
    }

    setQuestion("");
  }, [conversationId]);

  useEffect(() => {
    if (!transcriptScrollKey) {
      return;
    }

    const transcriptElement = transcriptRef.current;
    const transcriptEndElement = transcriptEndRef.current;

    if (!transcriptElement || !transcriptEndElement) {
      return;
    }

    transcriptEndElement.scrollIntoView({ block: "end" });
    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [transcriptScrollKey]);

  useLayoutEffect(() => {
    if (questionCursor === null || !questionRef.current) {
      return;
    }

    questionRef.current.setSelectionRange(questionCursor, questionCursor);
    setQuestionCursor(null);
  }, [question, questionCursor]);

  function insertQuestionLineBreak(textarea: HTMLTextAreaElement): void {
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const nextQuestion = `${question.slice(0, selectionStart)}
${question.slice(selectionEnd)}`;
    const nextCursor = selectionStart + 1;

    setQuestion(nextQuestion);
    setQuestionCursor(nextCursor);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    const isLineBreakShortcut = event.ctrlKey && !event.altKey && !event.metaKey && (event.key === "Enter" || event.key.toLowerCase() === "j");

    if (isLineBreakShortcut) {
      event.preventDefault();
      insertQuestionLineBreak(event.currentTarget);
      return;
    }

    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();

    if (question.trim() && !isSubmitting) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className="flex h-screen min-h-[42rem] flex-col overflow-hidden px-4 py-4 text-[var(--color-foreground)] md:px-6 lg:px-8">
      <header className="relative z-50 shrink-0 overflow-visible rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-panel)] backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/" className="rounded-3xl px-2 py-1">
              <span className="block font-[var(--font-display)] text-3xl font-bold tracking-[-0.03em] text-[var(--color-card-foreground)]">ikis.ai</span>
              <span className="block text-xs uppercase tracking-[0.16em] text-[var(--color-muted-foreground)]">grounded corpus chat</span>
            </Link>
            <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
              {compactNavItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.end}
                    className={({ isActive }) => cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)] hover:text-[var(--color-secondary-foreground)]",
                      isActive && "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <details className="group relative z-[90]">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm font-semibold text-[var(--color-card-foreground)] transition-colors hover:bg-[var(--color-secondary)]">
                <Library className="h-4 w-4" />
                Sessions
              </summary>
              <div className="absolute right-0 z-[100] mt-2 grid max-h-[min(28rem,calc(100vh-8rem))] w-[min(22rem,calc(100vw-2rem))] gap-2 overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-panel)]">
                <Link to="/chat" className="block min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm font-semibold text-[var(--color-card-foreground)] transition-colors hover:bg-[var(--color-secondary)]">
                  New grounded chat
                </Link>
                {conversations.length > 0 ? conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    to={`/chat/${encodeURIComponent(conversation.id)}`}
                    className={cn(
                      "block min-w-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 text-sm leading-5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]",
                      conversation.id === conversationId && "border-[var(--color-primary)] text-[var(--color-card-foreground)]",
                    )}
                  >
                    <span className="block truncate font-semibold text-[var(--color-card-foreground)]">{formatSessionLabel(conversation.title, conversation.id)}</span>
                    <span className="mt-1 block truncate text-xs uppercase tracking-[0.14em]">{conversation.id}</span>
                  </Link>
                )) : (
                  <p className="px-4 py-3 text-sm leading-6 text-[var(--color-muted-foreground)]">No saved conversations yet.</p>
                )}
              </div>
            </details>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(18rem,0.86fr)_minmax(0,1.14fr)]">
        <Card className="flex min-h-[26rem] min-w-0 flex-col overflow-hidden p-0">
          <div className="shrink-0 border-b border-[var(--color-border)] p-5">
            <CardHeader>
              <ShieldCheck className="h-5 w-5 text-[var(--color-primary)]" />
              <CardTitle>Source context</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {noEvidence ? "No citations were created because retrieval found insufficient evidence." : "Citations and opened source text stay beside the conversation."}
            </CardContent>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <Outlet />
            <div className="grid gap-3" data-testid="citation-list">
              {latestPreviews.length > 0 ? latestPreviews.map((preview) => (
                <Link
                  key={preview.citationId}
                  data-testid="citation-link"
                  to={preview.previewUrl}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm leading-6 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-secondary)]"
                >
                  <span className="font-semibold text-[var(--color-card-foreground)]">[{preview.ordinal + 1}] {preview.documentTitle}</span>
                  <span className="mt-2 block">{preview.quote}</span>
                  <span className="mt-2 block text-xs uppercase tracking-[0.16em]">{preview.sourceLabel}</span>
                </Link>
              )) : (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 text-sm leading-7 text-[var(--color-muted-foreground)]">
                  <BookOpenText className="mb-3 h-5 w-5 text-[var(--color-primary)]" />
                  Ask with approved evidence; source cards and opened citation text will appear here.
                </div>
              )}
            </div>
            {transcript.latestRun ? (
              <Button className="mt-4 w-full" variant="secondary" asChild>
                <Link data-testid="retrieval-trace-link" to={`/retrieval/${encodeURIComponent(transcript.latestRun.id)}`}>Inspect retrieval trace</Link>
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="flex min-h-[30rem] min-w-0 flex-col overflow-hidden p-0">
          <div className="relative shrink-0 overflow-hidden border-b border-[var(--color-border)] p-5 md:p-6">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--color-primary-glow)] blur-3xl" />
            <div className="absolute -bottom-24 left-20 h-52 w-52 rounded-full bg-[var(--color-accent-glow)] blur-3xl" />
            <div className="relative">
              <Badge>Grounded conversation</Badge>
              <h1 className="mt-4 font-[var(--font-display)] text-4xl font-bold leading-none tracking-[-0.03em] text-[var(--color-card-foreground)] md:text-5xl">
                Ask Ikis
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--color-muted-foreground)]">
                Chat over approved corpus evidence. Answers keep citations close, and thin evidence is called out instead of hidden.
              </p>
            </div>
          </div>

          <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6" data-testid="chat-transcript">
            <div className="grid content-start gap-4">
              {messages.length > 0 ? messages.map((message) => (
                <div
                  key={message.id}
                  data-testid={message.role === "assistant" ? "chat-answer" : undefined}
                  className={message.role === "user"
                    ? "ml-auto max-w-2xl rounded-3xl bg-[var(--color-primary)] px-5 py-4 text-[var(--color-primary-foreground)]"
                    : "max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 leading-7 text-[var(--color-card-foreground)]"}
                >
                  {message.role === "assistant" ? (
                    <MarkdownContent
                      citationLinks={Object.fromEntries((previewsByMessageId[message.id] ?? []).map((preview) => [preview.ordinal + 1, preview.previewUrl]))}
                    >
                      {message.content}
                    </MarkdownContent>
                  ) : <div className="whitespace-pre-wrap">{message.content}</div>}
                </div>
              )) : (
                <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 text-[var(--color-muted-foreground)]">
                  Ask a grounded question once documents have been imported and approved. Ikis will answer from cited chunks or say when evidence is missing.
                </div>
              )}
              <div ref={transcriptEndRef} aria-hidden="true" />
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6">
            <Form method="post" action={formAction} className="grid gap-3">
              <input type="hidden" name="corpusId" value={corpusId} />
              <input type="hidden" name="conversationId" value={conversationId ?? ""} />
              <label className="grid gap-2 text-sm font-semibold text-[var(--color-card-foreground)]">
                Question
                <textarea
                  ref={questionRef}
                  data-testid="chat-question"
                  name="question"
                  value={question}
                  onChange={(event) => setQuestion(event.currentTarget.value)}
                  onKeyDown={handleQuestionKeyDown}
                  rows={3}
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
              <p className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-notice)] px-4 py-3 text-sm font-semibold text-[var(--color-card-foreground)]" role="status">
                {actionData.message}
              </p>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}
