# Module 4: Answers with Receipts

Write file: `modules/04-answers-with-receipts.html` containing ONLY `<section class="module" id="module-4">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads rulebooks and notes, then asks questions in chat; answers cite exact uploaded passages, and the app refuses to answer without evidence. Tech: React web app, Python FastAPI backend, background worker, Postgres, Qdrant (vector database), OpenAI.

**Learner:** a "vibe coder" — zero CS background. Tooltip every technical term aggressively. Tone: smart friend.

**Consistent actor set:** Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖. This module adds two roles *inside* the API: the Librarian 🔎 (retrieval service) and the Fact-Checker 🧐 (citation validator).

**Course title:** "Inside The Stacks". Accent: amber/gold (pre-configured).

## Teaching Arc

- **Metaphor:** A courtroom with strict rules of evidence. Retrieved chunks are the **exhibits** admitted into evidence. The LLM is an eloquent witness who may ONLY testify about admitted exhibits, and must point at one for every claim ("as Exhibit [1] shows…"). The Fact-Checker is the judge: testimony citing an exhibit that isn't on the table gets the whole answer thrown out. No evidence? Case dismissed — never a confident story invented on the stand.
- **Opening hook:** "AI chatbots are famous for confidently making things up. This app almost never does. Not because its AI is smarter — but because the code around the AI is suspicious of it."
- **Key insight:** Hallucination isn't fixed by trusting the model more; it's fixed by *architecture* — retrieval decides what the model may see, the prompt confines it to that material, and validators check its citations after the fact. Four independent exits all lead to an honest "no evidence."
- **Why should I care:** This is the blueprint for any "chat with my documents" product you'll ever ask an AI to build. Knowing the guardrails means you can request them by name — and recognize their absence when a demo hallucinates.

## Screens (suggested, 6)

1. **Rules of evidence.** Courtroom metaphor + the four-exit idea as 4 small cards: no exhibits found → dismissed; witness cites nothing valid → dismissed; markers can't be repaired → dismissed; markers don't match exhibits → dismissed. All four converge on the same honest "no evidence" reply — and in the first case the witness is never even called (no OpenAI cost).
2. **HERO VISUAL — group chat animation** of one chat turn (see below).
3. **The Librarian's shortlist.** Code↔English: snippet A (the ranking loop). Explain over-fetching: ask Qdrant for ~10× more results than needed, then filter — score too low? out. Duplicate? out. Not part of the live collection? out. Stop at the best 8. Callout: the bar (`retrieval_min_score`) and the shortlist size (`retrieval_top_k`) are just settings — tuning knobs, not code surgery.
4. **The witness's instructions.** Code↔English: snippet B (the system prompt — the actual words!) and snippet C (how exhibits are packed with the question). Aha callout: "A 'prompt' isn't magic — it's a paragraph of English sitting in the codebase. You can open the file and edit the app's personality."
5. **The judge's review.** Code↔English: snippet D (filing one citation row per exhibit) + snippet E (the sandboxed viewer on the frontend). Explain the click-through: each [1] marker opens a side panel showing the exact passage — and archived webpages render inside an iframe (tooltip) whose `sandbox=""` setting is the strictest possible: the archived page can be *seen* but can never run code in your app. Trust nothing, display everything.
6. **Quiz.**

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — the Librarian's filter (score bar, duplicates, top 8)
File: `apps/api/app/retrieval_service.py` (lines 210–224) — Python

```python
        for hit in hits:
            candidate = retrieval_candidate_from_hit(self.db, hit, scope)
            if candidate is None:
                filtered_missing_chunk_count += 1
                continue
            if candidate.score < self.settings.retrieval_min_score:
                filtered_low_score_count += 1
                continue
            context_key = retrieval_candidate_identity_key(candidate)
            if context_key in seen_context_keys:
                deduplicated_count += 1
                continue
            seen_context_keys.add(context_key)
            candidates.append(candidate)
            if len(candidates) >= self.settings.retrieval_top_k:
                break
```

Teaching notes: also note the counting — every rejection is *tallied* (`filtered_low_score_count`…) and saved in an audit record, so you can later ask "why did this search come up empty?"

### Snippet B — the witness's instructions (the real system prompt)
File: `apps/api/app/chat_session_rag.py` (lines 226–233) — Python

```python
    return (
        "Answer only from the supplied context. Return JSON with answer and citations as chunk IDs. "
        "Write the answer in concise Markdown when helpful, and use Markdown tables for comparisons or structured summaries when they improve clarity. "
        "Keep bracketed citation markers like [1] or [2][3] immediately next to the supported claims in the answer text, "
        "where each marker corresponds to the order of the returned citations. "
        "Every factual sentence must carry its citation inline at the sentence level, and if the same source supports multiple factual sentences, repeat the same marker on each sentence. "
        "Repeat [1] on every factual sentence that the same source supports. "
        "Never leave citations only at the end of a paragraph when they belong to multiple sentences. "
```

Teaching notes: notice how *repetitive and specific* it is ("Repeat [1] on every factual sentence…") — real prompts read like instructions to a well-meaning but literal-minded intern.

### Snippet C — packing the exhibits with the question
File: `apps/api/app/chat_session_rag.py` (lines 243–247) — Python

```python
def _user_prompt(question: str, contexts: Sequence[ContextChunk]) -> str:
    context_text = "\n\n".join(
        f"chunk_id={context.chunk_id}\n{context.content}" for context in contexts
    )
    return f"Question: {question}\n\nContext:\n{context_text}"
```

Teaching notes: this is all "RAG" is — pasting the found passages under the question. Each exhibit is labeled with its `chunk_id` so the model can cite it.

### Snippet D — filing the receipts
File: `apps/api/app/chat_session_service.py` (lines 147–157) — Python

```python
    for index, context in enumerate(cited_contexts, start=1):
        db.add(
            Citation(
                assistant_message_id=assistant_message.id,
                retrieval_run_id=retrieval_run.id,
                document_chunk_id=context.chunk_id,
                label=f"[{index}]",
                metadata_json=_to_json(citation_metadata[context.chunk_id]),
                created_at=utcnow(),
            )
        )
```

Teaching notes: every citation becomes a permanent database row linking answer → search run → exact chunk. The receipts survive forever, which is why old chats still have working [1] links.

### Snippet E — showing evidence without trusting it (frontend)
File: `apps/web/app/routes/chat.tsx` (lines 644–653) — TypeScript/React

```tsx
      {view.viewerUrl ? (
        <iframe
          className="citation-viewer-frame"
          src={view.viewerUrl}
          title={`Archived citation ${citation.label}`}
          sandbox={citationIframeSandbox}
          referrerPolicy="same-origin"
          loading="lazy"
        />
      ) : null}
```

Teaching notes: `citationIframeSandbox` is defined as `""` — the maximum-security setting. The archived rulebook page displays, but any script inside it is frozen solid.

## Interactive Elements

- [x] **Group chat animation** (MANDATORY here) — id like `rag-turn-chat`. Cast: API 🚪, Librarian 🔎, Qdrant 🧭, OpenAI 🤖, Fact-Checker 🧐. One chat turn:
  1. API 🚪: "Question in: 'Can a wizard cast in heavy armor?'"
  2. Librarian 🔎: "Converted to 1,536 numbers. Qdrant, what's nearby?"
  3. Qdrant 🧭: "80 candidates, sorted by similarity."
  4. Librarian 🔎: "3 below the confidence bar, 2 duplicates — out. Admitting the top 8 as exhibits."
  5. OpenAI 🤖: "Draft ready. Cited exhibits [1] and [2]."
  6. Fact-Checker 🧐: "[1] ✅ on the exhibit list. [2] ✅. Markers numbered correctly. Approved."
  7. API 🚪: "Filing answer + receipts in Postgres. Delivering to the browser."
  (Optionally add a grim second beat: OpenAI cites a chunk that wasn't admitted → Fact-Checker 🧐: "Overruled. The user sees 'no evidence', not your creative writing.")
- [x] **Code↔English translations** — snippets A–E above.
- [x] **Quiz** — 3–4 questions, scenario/architecture:
  1. (Scenario) "You ask about a rule you KNOW is in the book, but get 'no evidence.' Give two plausible causes from this module." → the book was never successfully indexed (assembly line), or every match scored below `retrieval_min_score` — both findable in the audit trail. Not: "the AI forgot."
  2. (Architecture) "A rival 'chat with your PDFs' demo answers even when the PDF says nothing — confidently wrong. Which guardrail from this module is it missing?" → any/all of: restrictive prompt, citation validation, no-evidence short-circuit. Best single answer: it doesn't validate answers against retrieved evidence.
  3. (Steering) "You want answers to draw from 15 passages instead of 8. What do you tell your AI assistant to change?" → the `retrieval_top_k` setting — one config value, not a rewrite.
  4. (Tracing) "Where does the text shown in the citation side panel ultimately come from?" → the chunk row in Postgres that the citation points at (cut by the assembly line in Module 3) — not from OpenAI's memory of the answer.
- [x] **Glossary tooltips** — RAG, LLM, hallucination, prompt / system prompt, context (as in context window), similarity score, threshold, dedupe, top-k, JSON, iframe, sandbox, audit trail, Markdown.
- [ ] Data flow animation — NO (Modules 1 and 3 have them). The group chat is the hero.

## Reference Files to Read

- `references/content-philosophy.md` — all
- `references/gotchas.md` — all
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Group Chat Animation", "Callout Boxes", "Glossary Tooltips", "Pattern/Feature Cards"
- `references/design-system.md` → "Module Structure"

## Connections

- **Previous module:** Module 3 "The Assembly Line" — built the warehouse of chunks and vectors this module searches. Open by cashing in that setup.
- **Next module:** Module 5 "Versions & Vaults" — how whole libraries are built, verified, and swapped live without risk. Bridge: "You've seen one question and one book. Next: how the app swaps an entire library without anyone noticing."
- **Tone/style:** group chat container MUST have an `id`. Text ≤3 sentences per block, ≥50% visual.
