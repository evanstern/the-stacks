# Module 1: The Question Journey

Write file: `modules/01-the-question-journey.html` containing ONLY `<section class="module" id="module-1">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads their own rulebooks and campaign notes (Markdown, text, HTML, EPUB, or saved-webpage ZIP files), and then asks questions in a chat. The app answers using ONLY the uploaded material, and every factual sentence carries a numbered citation like [1] that links to the exact source passage. When it can't find real evidence, it refuses to answer instead of guessing. Tech: React web app, Python FastAPI backend, a background worker, Postgres (regular database), Qdrant (vector database), OpenAI (embeddings + chat model).

**Learner:** a "vibe coder" — builds software by instructing AI tools, zero CS background. Tooltip every technical term aggressively (API, backend, frontend, cookie, vector, database, endpoint, JSON, HTTP, LLM, RAG…). Tone: smart friend, not professor.

**Consistent actor set** (use these names/emoji in chats and flow animations across the whole course): Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖.

**Course title:** "Inside The Stacks". Accent color: amber/gold (already configured — just use existing CSS classes).

## Teaching Arc

- **Metaphor:** A closed-stacks research library. In an ordinary library you browse shelves yourself. In a closed-stacks library (which is literally what "the stacks" means), you hand a librarian a question slip at the desk, a runner disappears into the stacks, and your material comes back with call slips pointing at exact pages. The app IS this library, digitized. This metaphor belongs to Module 1 — later modules use different ones.
- **Opening hook:** "You type 'Can a wizard wear armor?' and hit Enter. Two seconds later: an answer, with little [1] [2] footnotes that open the exact paragraph of the rulebook you uploaded. This course is about everything that happens inside those two seconds — and inside the machine you built."
- **Key insight:** An app is not one program — it's a relay race of small programs passing messages. A question makes ~6 hops (browser → API → OpenAI → Qdrant → OpenAI → back), and each hop is understandable on its own.
- **Why should I care:** When you can name the hops, you can tell an AI assistant *where* to make a change ("that's a backend retrieval problem, not a UI problem") and *where* to look when something breaks.

## Screens (suggested, 5)

1. **Hero / what this app is.** Course title, one-paragraph pitch of The Stacks, and 3 feature cards (Ask with receipts / Bring your own books / Refuses to bluff). State clearly: this is Module 1 of 6, and the course teaches how it's built.
2. **The closed-stacks library metaphor** + quick visual of the cast (6 actor badges with one-liners — full introductions come in Module 2, so keep it to a teaser).
3. **HERO VISUAL — Data flow animation** of one question (see below). This is the module's centerpiece.
4. **Code↔English:** the send handler (snippet A), then the no-evidence short-circuit (snippet B) as a second, shorter translation. Callout box after B: "The app would rather say 'I don't know' than make something up — and it doesn't even bother (or pay for) the AI call when there's no evidence."
5. **Aha + quiz.** Aha callout: *perceived vs. actual progress* — the chat's "Searching the archive… Reading sources… Composing answer…" animation is theater; the real work is ONE request that returns the whole answer at once (`apps/web/app/routes/chat.tsx:494-536` even says "Local preparation estimates shown while the request is pending"). Then the quiz.

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — the chat send handler (frontend)
File: `apps/web/app/routes/chat.tsx` (lines 111–140) — TypeScript/React

```tsx
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
```

Teaching notes for the translation: "optimistic" UI = show your message instantly before the server confirms (the fake `"pending-user-message"`), so the app feels fast; on failure it politely puts your draft back in the box.

### Snippet B — the no-evidence short-circuit (backend)
File: `apps/api/app/chat_session_service.py` (lines 104–113) — Python

```python
    if not contexts:
        assistant_message = _commit_no_evidence_turn(
            db, session, retrieval_run, retrieval_metadata
        )
        return assistant_message

    result = graph_invoker.invoke(
        {"question": content, "contexts": contexts},
        {"configurable": {"thread_id": session.id}},
    )
```

Teaching notes: `contexts` = the passages the librarian found. If the list is empty, the expensive AI call never happens — the answer is an honest "no evidence."

## Interactive Elements

- [x] **Data flow animation** (MANDATORY hero). Actors in order: Web app 🖥️, API 🚪, OpenAI 🤖, Qdrant 🧭, Postgres 🗃️. Steps (adapt wording to fit the `data-steps` JSON format):
  1. Web app → API: "POST the question + session cookie" (you hit Enter)
  2. API: "Checks the cookie — is this really the operator?" (self highlight)
  3. API → OpenAI: "Turn this question into 1,536 numbers (an embedding)"
  4. API → Qdrant: "Find passages whose numbers are closest to these"
  5. API → OpenAI: "Here are the 8 best passages. Answer ONLY from them, with citations."
  6. API: "Fact-checks every citation against the passages" (self highlight)
  7. API → Postgres: "Files the question, answer, citations, and a search audit record"
  8. API → Web app: "The answer, with [1] [2] markers you can click"
- [x] **Code↔English translation** — snippets A and B above.
- [x] **Quiz** — 3 questions, tracing/debugging style:
  1. (Tracing) "You hit Enter and your question appears in the chat instantly — but the answer takes two seconds. Why does your own message show up immediately?" → optimistic UI: the web app displays it before the server replies. Distractors: "the server answers user messages faster", "it's read from Postgres", "the browser caches it".
  2. (Debugging) "The chat replies 'no evidence found' to every single question, even easy ones. Which hop of the journey would you suspect FIRST?" → the search hop (Qdrant empty / nothing indexed) — not OpenAI, not the browser.
  3. (Architecture) "A friend wants the app to also answer from general knowledge when the books don't cover something. Which step in the journey would have to change?" → step 5's rule ("answer ONLY from the passages") — the prompt sent to OpenAI.
- [x] **Glossary tooltips** — at minimum: app/frontend/backend, API, HTTP request, session cookie, embedding, vector, database, Postgres, Qdrant, LLM, citation, RAG (define gently: "Retrieval-Augmented Generation — look things up first, then let the AI write from what was found").
- [ ] Group chat — NO (Module 2 and 4 have them).

## Reference Files to Read

- `references/content-philosophy.md` — all (content rules)
- `references/gotchas.md` — all (checklist)
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Message Flow / Data Flow Animation", "Callout Boxes", "Glossary Tooltips", "Pattern/Feature Cards"
- `references/design-system.md` → "Module Structure" (and skim "Syntax Highlighting" class names for code blocks)

## Connections

- **Previous module:** none — this opens the course. Open with the product, not the code.
- **Next module:** Module 2 "Meet the Cast" — introduces the five running services (Web, API, Worker, Postgres, Qdrant) and how Docker Compose starts them. End Module 1 with a bridge like: "You've seen the relay race. Next: meet the runners."
- **Tone/style:** warm, plain language, 2-3 sentence max text blocks, ≥50% visual per screen. Flow animation container needs `data-steps='[...]'` JSON per the reference. Chat containers need `id` attributes (not used in this module).
