import { Form, useLoaderData, useNavigate, useNavigation, useRevalidator } from "react-router";
import { AlertCircle, ArrowUp, BookOpen, CheckCircle2, FileText, Loader2, PenLine, Plus, Search, X } from "lucide-react";
import type { ComponentProps, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createSession,
  getSession,
  getSessionMessages,
  listSessions,
  sendSessionMessage,
  type ChatMessage,
  type ChatSession,
  type Citation,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";

type ChatLoaderData = {
  session: ChatSession;
  messages: ChatMessage[];
  sessions: ChatSession[];
};

type CitationMetadata = {
  source: string;
  title: string;
  location: string;
  excerpt: string;
};

type PendingCitationFocus = {
  citationId: string;
  messageId: string;
};

type ChatSubmitEvent = Parameters<NonNullable<ComponentProps<typeof Form>["onSubmit"]>>[0];

export async function chatLoader({ params }: { params: { sessionId?: string } }) {
  await requireAuth();
  if (!params.sessionId) {
    throw new Response("Session id required", { status: 400 });
  }

  const [session, messages, sessions] = await Promise.all([
    getSession(params.sessionId),
    getSessionMessages(params.sessionId),
    listSessions(),
  ]);
  return { session, messages, sessions } satisfies ChatLoaderData;
}

export function ChatRoute() {
  const { session, messages, sessions } = useLoaderData() as ChatLoaderData;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optimisticQuestion, setOptimisticQuestion] = useState<ChatMessage | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectedCitationMessageId, setSelectedCitationMessageId] = useState<string | null>(null);
  const [pendingCitationFocus, setPendingCitationFocus] = useState<PendingCitationFocus | null>(null);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSending = navigation.state !== "idle" || Boolean(optimisticQuestion);
  const visibleMessages = optimisticQuestion ? [...messages, optimisticQuestion] : messages;

  useLayoutEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const scrollToBottom = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    scrollToBottom();
    const animationFrame = window.requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 50);
    const resizeObserver = new ResizeObserver(scrollToBottom);
    resizeObserver.observe(scrollContainer);

    if (scrollContainer.firstElementChild) {
      resizeObserver.observe(scrollContainer.firstElementChild);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      resizeObserver.disconnect();
    };
  }, [session.id, visibleMessages.length]);

  async function handleSubmit(event: ChatSubmitEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setError(null);
    setDraft("");
    setOptimisticQuestion({
      id: "pending-user-message",
      chat_session_id: session.id,
      role: "user",
      content,
      metadata: {},
      citations: [],
      created_at: new Date().toISOString(),
    });

    try {
      await sendSessionMessage(session.id, content);
      await revalidator.revalidate();
      formRef.current?.reset();
    } catch (sendError) {
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : "The archive could not answer just now.");
    } finally {
      setOptimisticQuestion(null);
    }
  }

  async function handleNewChat() {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    setError(null);

    try {
      const nextSession = await createSession();
      await navigate(`/chat/${nextSession.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The archive could not create a new chat.");
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSessionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextSessionId = event.target.value;
    if (nextSessionId && nextSessionId !== session.id) {
      void navigate(`/chat/${nextSessionId}`);
    }
  }

  function insertDraftNewline() {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((currentDraft) => `${currentDraft}\n`);
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const nextDraft = `${draft.slice(0, selectionStart)}\n${draft.slice(selectionEnd)}`;
    setDraft(nextDraft);
    window.requestAnimationFrame(() => {
      textarea.selectionStart = selectionStart + 1;
      textarea.selectionEnd = selectionStart + 1;
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }

    if (event.key.toLowerCase() === "j" && event.ctrlKey) {
      event.preventDefault();
      insertDraftNewline();
    }
  }

  const latestAssistantCitations = latestCitations(visibleMessages);
  const selectedCitationMessage = selectedCitationMessageId
    ? visibleMessages.find((message) => message.id === selectedCitationMessageId && message.role === "assistant" && message.citations.length > 0)
    : null;
  const railCitations = selectedCitationMessage?.citations ?? latestAssistantCitations;

  useEffect(() => {
    setIsCitationDrawerOpen(false);
  }, [session.id]);

  useEffect(() => {
    if (!isCitationDrawerOpen) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCitationDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCitationDrawerOpen]);

  useEffect(() => {
    if (!pendingCitationFocus) {
      return;
    }

    const railHasTarget = railCitations.some((citation) => citation.id === pendingCitationFocus.citationId);
    if (!railHasTarget) {
      return;
    }

    window.requestAnimationFrame(() => {
      openCitationById(pendingCitationFocus.citationId);
      setPendingCitationFocus((currentFocus) => (
        currentFocus?.citationId === pendingCitationFocus.citationId
          && currentFocus.messageId === pendingCitationFocus.messageId
          ? null
          : currentFocus
      ));
    });
  }, [pendingCitationFocus, railCitations]);

  function handleCitationMarkerClick(message: ChatMessage, citation: Citation) {
    setSelectedCitationMessageId(message.id);
    setPendingCitationFocus({ citationId: citation.id, messageId: message.id });
    setIsCitationDrawerOpen(true);
  }

  return (
    <div className="chat-workspace">
      {isCitationDrawerOpen ? (
        <button
          type="button"
          className="citation-backdrop citation-backdrop-open"
          aria-label="Close citations"
          onClick={() => setIsCitationDrawerOpen(false)}
        />
      ) : null}
      <CitationRail citations={railCitations} isOpen={isCitationDrawerOpen} onClose={() => setIsCitationDrawerOpen(false)} />

      <section className="chat-panel">
        <div className="chat-header">
          <div>
            <p className="micro-label text-clay-dark">Chat session</p>
            <h1 className="mt-2 font-serif text-4xl tracking-[-0.05em] text-foreground">
              {session.title ?? "Untitled table"}
            </h1>
          </div>
          <div className="session-controls">
            <Button
              type="button"
              variant="outline"
              className="citation-open-button"
              aria-controls="citation-rail"
              aria-expanded={isCitationDrawerOpen}
              onClick={() => setIsCitationDrawerOpen(true)}
            >
              <BookOpen className="size-4" aria-hidden="true" />
              Citations
            </Button>
            <label className="sr-only" htmlFor="session-select">Conversation</label>
            <select id="session-select" className="session-select" value={session.id} onChange={handleSessionChange}>
              {sessions.map((chatSession) => (
                <option key={chatSession.id} value={chatSession.id}>
                  {(chatSession.title ?? "Untitled table") + " / " + chatSession.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button type="button" className="new-chat-button" onClick={handleNewChat} disabled={isCreatingSession} aria-label="New chat">
              {isCreatingSession ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="messages-scroll" aria-live="polite">
          {visibleMessages.length === 0 ? (
            <EmptyThread />
          ) : (
            <div className="message-list">
              {visibleMessages.map((message) => (
                <MessageBubble key={message.id} message={message} onCitationMarkerClick={handleCitationMarkerClick} />
              ))}
              {optimisticQuestion ? <AssistantLoading /> : null}
            </div>
          )}
        </div>

        <div className="composer">
          {error ? (
            <div className="error-box" style={{ marginBottom: "1rem" }} role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}
          <Form ref={formRef} method="post" className="composer-row" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="message">
              Message
            </label>
            <textarea
              ref={textareaRef}
              id="message"
              name="message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask the archive about your table notes..."
              rows={2}
              className="composer-textarea"
              disabled={isSending}
              required
            />
            <Button type="submit" className="send-button" disabled={!draft.trim() || isSending} aria-label="Send message">
              {isSending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
            </Button>
          </Form>
          <p className="mt-3 text-xs leading-5 text-muted">Enter sends. Shift+Enter or Ctrl+J adds a new line.</p>
        </div>
      </section>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="empty-thread">
      <p className="micro-label text-muted">Ready for retrieval</p>
      <p className="mt-3 max-w-md font-serif text-3xl tracking-[-0.04em] text-foreground">
        Ask a grounded question and the archive will preserve the answer here.
      </p>
    </div>
  );
}

function MessageBubble({ message, onCitationMarkerClick }: { message: ChatMessage; onCitationMarkerClick: (message: ChatMessage, citation: Citation) => void }) {
  const isUser = message.role === "user";
  const hasAssistantCitations = !isUser && message.citations.length > 0;

  return (
    <article className={cn("message-row", isUser ? "message-row-user" : "message-row-assistant")}>
      <div
        className={cn(
          "message-bubble",
          isUser ? "message-bubble-user" : "text-foreground",
        )}
      >
        <div className="message-meta">
          <p className={cn("micro-label", isUser ? "text-cream" : "text-clay-dark")}>{isUser ? "You" : "The Stacks"}</p>
          <time className="font-mono text-[0.65rem] uppercase tracking-[0.14em] opacity-70" dateTime={message.created_at}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
        </div>
        <MessageText
          content={message.content}
          citations={hasAssistantCitations ? message.citations : []}
          onCitationMarkerClick={(citation) => onCitationMarkerClick(message, citation)}
        />
      </div>
    </article>
  );
}

export function MessageText({ content, citations, onCitationMarkerClick }: { content: string; citations: Citation[]; onCitationMarkerClick: (citation: Citation) => void }) {
  const labelMap = citationLabelMap(citations);
  const labelsInContent = contentCitationLabels(content, labelMap);
  const appendedCitations = citations.filter((citation) => !labelsInContent.has(citation.label));

  return (
    <div className="message-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const safeHref = safeMarkdownHref(href);
            if (!safeHref) {
              return <span>{children}</span>;
            }

            return (
              <a href={safeHref} target="_blank" rel="noreferrer noopener">
                {renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}
              </a>
            );
          },
          code: ({ children, className }) => <code className={className}>{children}</code>,
          em: ({ children }) => <em>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</em>,
          strong: ({ children }) => <strong>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</strong>,
          h1: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          h2: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          h3: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          h4: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          h5: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          h6: ({ children }) => <p className="message-heading">{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          p: ({ children }) => <p>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</p>,
          li: ({ children }) => <li>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</li>,
          table: ({ children }) => (
            <div className="message-table-scroll" style={{ maxWidth: "100%", overflowX: "auto" }}>
              <table>{children}</table>
            </div>
          ),
          td: ({ children }) => <td>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</td>,
          th: ({ children }) => <th>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</th>,
          blockquote: ({ children }) => <blockquote>{renderCitationNodeChildren(children, labelMap, onCitationMarkerClick)}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
      {appendedCitations.length > 0 ? <CitationMarkerGroup citations={appendedCitations} onCitationMarkerClick={onCitationMarkerClick} /> : null}
    </div>
  );
}

export function CitationMarkerGroup({ citations, onCitationMarkerClick }: { citations: Citation[]; onCitationMarkerClick: (citation: Citation) => void }) {
  return (
    <aside
      className="mt-3 inline-flex max-w-full items-start gap-2 rounded-2xl border border-[var(--danger)] bg-[color-mix(in_srgb,var(--amber)_18%,var(--cream))] px-3 py-2 text-xs leading-5 text-[var(--danger)] shadow-inset"
      role="note"
      aria-label="Unmatched citations appended after the answer"
      title="These citations were returned by the archive but their labels were not found in the answer text."
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="micro-label block text-[var(--danger)]">Unmatched citations</span>
        <span className="text-[var(--muted)]">Available sources not placed inline:</span>
        <span className="citation-marker-group" title="Appended unmatched citation markers">
          {citations.map((citation) => (
            <CitationMarker key={citation.id} citation={citation} onCitationMarkerClick={onCitationMarkerClick} />
          ))}
        </span>
      </span>
    </aside>
  );
}

export function CitationMarker({ citation, onCitationMarkerClick }: { citation: Citation; onCitationMarkerClick: (citation: Citation) => void }) {
  return (
    <button
      type="button"
      className="citation-marker"
      aria-label={`Open citation ${citation.label}`}
      onClick={() => onCitationMarkerClick(citation)}
    >
      {citation.label}
    </button>
  );
}

function AssistantLoading() {
  const phases = [
    { label: "Searching the archive", detail: "Preparing likely source matches", icon: Search },
    { label: "Reading sources", detail: "Reviewing persisted notes for context", icon: FileText },
    { label: "Composing answer", detail: "Shaping a grounded response", icon: PenLine },
    { label: "Checking citations", detail: "Keeping references ready for review", icon: CheckCircle2 },
  ];

  return (
    <article className="message-row message-row-assistant">
      <div className="assistant-loading" role="status" aria-live="polite" aria-label="The Stacks is preparing a response">
        <div className="assistant-loading-header">
          <span className="assistant-loading-seal" aria-hidden="true">
            <Loader2 className="size-4 animate-spin" />
          </span>
          <div>
            <p className="micro-label text-clay-dark">The Stacks is preparing</p>
            <p className="assistant-loading-title">Gathering context for a grounded answer</p>
          </div>
        </div>

        <ol className="assistant-loading-phases" aria-label="Simulated preparation steps">
          {phases.map((phase, index) => {
            const PhaseIcon = phase.icon;

            return (
              <li key={phase.label} className="assistant-loading-phase" style={{ "--phase-index": index } as CSSProperties}>
                <span className="assistant-loading-phase-icon" aria-hidden="true">
                  <PhaseIcon className="size-3.5" />
                </span>
                <span className="assistant-loading-phase-copy">
                  <span>{phase.label}</span>
                  <small>{phase.detail}</small>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}

function CitationRail({ citations, isOpen, onClose }: { citations: Citation[]; isOpen: boolean; onClose: () => void }) {
  return (
    <aside
      id="citation-rail"
      className={cn("citation-rail", isOpen ? "citation-rail-open" : null)}
      aria-label="Citations"
      role={isOpen ? "dialog" : undefined}
    >
      <div className="citation-heading">
        <span className="citation-icon">
          <BookOpen className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="micro-label text-muted">Citation rail</p>
          <p className="mt-1 text-sm text-foreground">Latest answer sources</p>
        </div>
        <Button type="button" variant="ghost" className="citation-close-button" aria-label="Close citations" onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="citation-list">
        {citations.length === 0 ? (
          <p className="empty-citations">
            Citations from the latest assistant answer will pin here, keeping the thread clear.
          </p>
        ) : null}
        {citations.map((citation) => (
          <CitationCard key={citation.id} citation={citation} />
        ))}
      </div>
    </aside>
  );
}

function CitationCard({ citation }: { citation: Citation }) {
  const metadata = citationMetadata(citation);
  const cardId = citationCardId(citation.id);
  const summaryId = citationSummaryId(citation.id);

  return (
    <details id={cardId} className="citation-card">
      <summary id={summaryId} className="citation-summary" tabIndex={0}>
        <span className="citation-label">
          {citation.label}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="flex flex-wrap items-center gap-2 text-foreground">
            <BookOpen className="size-3.5 text-clay-dark" aria-hidden="true" />
            <span className="font-semibold">{metadata.source}</span>
            <span className="text-muted">/</span>
            <span>{metadata.title}</span>
          </span>
          <span className="mt-1 block text-muted">{metadata.location}</span>
        </span>
      </summary>
      <div className="citation-body">
        <p className="citation-excerpt">{metadata.excerpt}</p>
        <dl className="grid gap-2 font-mono text-[0.65rem] uppercase tracking-[0.12em]">
          <div>
            <dt className="text-muted">Citation id</dt>
            <dd className="break-anywhere text-foreground">{citation.id}</dd>
          </div>
          <div>
            <dt className="text-muted">Chunk id</dt>
            <dd className="break-anywhere text-foreground">{citation.document_chunk_id}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export function renderCitationNodeChildren(children: ReactNode, labelMap: Map<string, Citation>, onCitationMarkerClick: (citation: Citation) => void): ReactNode {
  if (Array.isArray(children)) {
    return children.flatMap((child, index) => renderCitationNodeChild(child, labelMap, onCitationMarkerClick, index));
  }

  return renderCitationNodeChild(children, labelMap, onCitationMarkerClick, 0);
}

function renderCitationNodeChild(child: ReactNode, labelMap: Map<string, Citation>, onCitationMarkerClick: (citation: Citation) => void, index: string | number): ReactNode {
  if (typeof child === "string") {
    return renderCitationMarkers(child, labelMap, onCitationMarkerClick, index);
  }

  return child;
}

export function renderCitationMarkers(content: string, labelMap: Map<string, Citation>, onCitationMarkerClick: (citation: Citation) => void, keyPrefix: string | number = "citation"): ReactNode[] {
  if (labelMap.size === 0) {
    return [content];
  }

  const labelPattern = citationLabelPattern(labelMap);
  if (!labelPattern) {
    return [content];
  }

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match = labelPattern.exec(content);

  while (match) {
    const label = match[0];
    const citation = labelMap.get(label);

    if (citation) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      parts.push(<CitationMarker key={`${keyPrefix}-${citation.id}-${match.index}`} citation={citation} onCitationMarkerClick={onCitationMarkerClick} />);
      lastIndex = match.index + label.length;
    }

    match = labelPattern.exec(content);
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

export function contentCitationLabels(content: string, labelMap: Map<string, Citation>) {
  const labels = new Set<string>();
  const labelPattern = citationLabelPattern(labelMap);
  const searchableContent = markdownCitationSearchText(content);

  if (!labelPattern) {
    return labels;
  }

  let match = labelPattern.exec(searchableContent);
  while (match) {
    labels.add(match[0]);
    match = labelPattern.exec(searchableContent);
  }

  return labels;
}

export function markdownCitationSearchText(content: string) {
  const searchableLines: string[] = [];
  let fenceMarker: string | null = null;

  for (const line of content.split("\n")) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1].startsWith("`") ? "`" : "~";
      if (fenceMarker === marker) {
        fenceMarker = null;
      } else if (!fenceMarker) {
        fenceMarker = marker;
      }
      searchableLines.push("");
      continue;
    }

    searchableLines.push(fenceMarker ? "" : line.replace(/`+[^`]*`+/g, ""));
  }

  return searchableLines.join("\n");
}

export function citationLabelMap(citations: Citation[]) {
  return new Map(citations.map((citation) => [citation.label, citation]));
}

function citationLabelPattern(labelMap: Map<string, Citation>) {
  const labels = [...labelMap.keys()]
    .filter((label) => label.length > 0)
    .sort((first, second) => second.length - first.length)
    .map(escapeRegExp);

  return labels.length > 0 ? new RegExp(labels.join("|"), "g") : null;
}

function safeMarkdownHref(href: string | undefined) {
  if (!href) {
    return null;
  }

  const normalizedHref = href.trim();
  if (normalizedHref.startsWith("#") || normalizedHref.startsWith("/")) {
    return normalizedHref;
  }

  try {
    const url = new URL(normalizedHref);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? normalizedHref : null;
  } catch {
    return null;
  }
}

function openCitationById(citationId: string) {
  const details = document.getElementById(citationCardId(citationId));
  if (!(details instanceof HTMLDetailsElement)) {
    return;
  }

  details.open = true;
  details.scrollIntoView({ behavior: "smooth", block: "center" });

  const summary = document.getElementById(citationSummaryId(citationId));
  if (summary instanceof HTMLElement) {
    summary.focus({ preventScroll: true });
  }
}

function citationCardId(citationId: string) {
  return `citation-card-${cssSafeId(citationId)}`;
}

function citationSummaryId(citationId: string) {
  return `citation-summary-${cssSafeId(citationId)}`;
}

function cssSafeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function citationMetadata(citation: Citation): CitationMetadata {
  const source = metadataString(citation.metadata.source_filename) ?? metadataString(citation.metadata.filename) ?? "Unknown source";
  const title = metadataString(citation.metadata.title) ?? metadataString(citation.metadata.source_title) ?? source;
  const location = citationLocation(citation);
  const excerpt = metadataString(citation.metadata.cited_text)
    ?? metadataString(citation.metadata.excerpt)
    ?? metadataString(citation.metadata.preview)
    ?? "Cited text unavailable.";

  return { source, title, location, excerpt: compactExcerpt(excerpt) };
}


function compactExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 520 ? `${normalized.slice(0, 520).trim()}...` : normalized;
}

function citationLocation(citation: Citation) {
  return metadataString(citation.metadata.section_heading)
    ?? metadataString(citation.metadata.section)
    ?? metadataString(citation.metadata.page_label)
    ?? metadataString(citation.metadata.page)
    ?? metadataString(citation.metadata.locator)
    ?? metadataChunkLocation(citation.metadata.chunk_index)
    ?? "Source location unavailable";
}

function metadataChunkLocation(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `Chunk ${value}`;
  }

  if (typeof value === "string") {
    const chunkIndex = value.trim();
    return chunkIndex.length > 0 ? `Chunk ${chunkIndex}` : null;
  }

  return null;
}

function latestCitations(messages: ChatMessage[]) {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.citations.length > 0);
  return latestAssistantMessage?.citations ?? [];
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
