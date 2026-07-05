# Module 6: When Things Break

Write file: `modules/06-when-things-break.html` containing ONLY `<section class="module" id="module-6">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags. This is the FINAL module — end with a short course wrap-up.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads rulebooks and notes, then asks questions in chat; answers cite exact uploaded passages. Tech: React web app, Python FastAPI backend, background worker, Postgres, Qdrant (vector database), OpenAI.

**Learner:** a "vibe coder" — zero CS background. Tooltip every technical term aggressively. Tone: smart friend.

**Consistent actor set:** Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖.

**Course title:** "Inside The Stacks". Accent: amber/gold (pre-configured).

## Teaching Arc

- **Metaphor:** A flight data recorder and the investigators who read it. Well-built software assumes things WILL break, so it narrates everything it does into permanent logs. When something goes wrong you don't guess — you pull the recorder: every job wrote events at every stage, every search wrote an audit run with scores and rejection tallies, every version change wrote a lifecycle event. The app even ships its own investigation room: the **Records** screen.
- **Opening hook:** "The difference between a pro and a beginner isn't fewer bugs. It's that when something breaks, the pro's system already wrote down what happened."
- **Key insight:** Debugging is reading, not guessing. This app makes failures *legible*: append-only event trails, errors sorted into named categories, honest status codes, retries for the flaky stuff, and scrubbed messages so users see truth without secrets.
- **Why should I care:** This module is your escape hatch from AI bug loops. When an AI assistant flails ("try this… now try this…"), YOU can say: "check the job's event log," "what status code does the API return?", "is this a 503 dependency failure or a 500 bug?" — and the loop breaks.

## Screens (suggested, 6)

1. **The recorder.** Metaphor + three "paper trail" cards mapping to what earlier modules planted: job event logs (Module 3's ticket stamps), retrieval runs with rejection tallies (Module 4's Librarian counts), version lifecycle events (Module 5's demolition log).
2. **The investigation room: the Records screen.** The app's built-in inspector with tabs — Overview, Uploads, Jobs, Sources, Retrieval, Chunks — everything cross-linked so you can walk the chain: upload → job → source → chunks → the searches that found them. Present the 5 nouns as icon cards (Upload = raw file, Job = the work ticket, Source = the shelved book, Chunk = one passage, Retrieval run = one search's receipt). Callout: the URL holds the state (`?section=jobs&job=…`) — every view is a link you can bookmark or paste to a collaborator (or an AI).
3. **Honest status codes.** Code↔English: snippet A (the API's error translation). Teach the three-digit status-code vocabulary: 404 "no such thing," 503 "a dependency I need is down — not my code's fault," 500 "my code broke." Aha: the API *sorts* failures by cause before picking a code — that's why error messages here are diagnoses, not shrugs.
4. **Self-healing and patience.** Code↔English: snippet B (retry with backoff) + snippet C (the polling hook). B: when OpenAI says "429: slow down," the code waits exactly as long as asked (`Retry-After`) and tries again — transient failures get patience, not crashes. C: the upload page re-asks the API every 1.5 seconds and *stops* once the job hits a terminal status — that's all a "live" progress view is.
5. **Truth without secrets.** Short screen: raw errors can leak file paths and tracebacks (tooltip), so the frontend detects and replaces unsafe diagnostics with "Check server logs for details" (`apps/web/app/routes/upload.tsx` — `safeBatchErrorCopy`, `unsafeDiagnosticPattern`), while the full traceback stays in operator-only metadata. Vague-on-purpose is a security feature, not laziness. Aha callout: the debugging playbook — symptom → which recorder to pull (stuck upload → job events; empty answers → retrieval run tallies; login weirdness → API status codes; total outage → `docker compose ps` / healthchecks).
6. **Quiz + course wrap-up.** The quiz (the course's climax — see below), then a closing screen: recap the six modules in one line each, and send them off: "You can now name the hops, the cast, the stations, the guardrails, and the paper trails. That vocabulary is exactly what steering an AI assistant well sounds like."

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — sorting failures into honest status codes
File: `apps/api/app/routes_sessions.py` (lines 177–200, trimmed to the except clauses is NOT allowed — use as-is) — Python

```python
    try:
        return chat_session_service_dependency.answer_session_message_envelope(
            db,
            session_id,
            payload.content,
            chat_client=chat_client,
            graph_invoker=graph_invoker,
            retrieval_service=retrieval_service,
            settings=settings,
        )
    except SessionMessageNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        ) from exc
    except (EmbeddingError, QdrantIndexError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_chat_failure_detail(exc),
        ) from exc
```

Teaching notes: exceptions are *typed by cause* (`EmbeddingError` vs `QdrantIndexError` vs "session doesn't exist") and only translated into HTTP codes at the front door. `db.rollback()` = undo the half-finished database changes so a failure leaves no mess.

### Snippet B — patience with a rate limit (retry + backoff)
File: `apps/api/app/embeddings.py` (lines 114–133) — Python

```python
for attempt in range(OPENAI_EMBEDDING_REQUEST_MAX_RETRIES + 1):
    response = httpx.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": model, "input": batch, "dimensions": dimensions, "encoding_format": "float"},
        timeout=60,
    )
    try:
        response.raise_for_status()
        return response
    except httpx.HTTPStatusError as exc:
        if response.status_code != 429 or attempt == OPENAI_EMBEDDING_REQUEST_MAX_RETRIES:
            raise EmbeddingError(...) from exc
        time.sleep(_retry_delay_seconds(response.headers.get("retry-after"), attempt))
```

NOTE: the `raise EmbeddingError(...)` line is abridged in this extract — present the block honestly as "lightly abridged from the file" in a caption, or link the file path; do not pretend the `...` is literal code in the translation.

Teaching notes: retries ONLY on 429 ("too many requests"), honors the server's `Retry-After` header, gives up after a max number of attempts. Every other error raises immediately — retrying a real bug just hides it.

### Snippet C — how a "live" progress bar actually works (frontend)
File: `apps/web/app/routes/upload.tsx` (lines 66–91) — TypeScript/React

```tsx
  useEffect(() => {
    if (!job || terminalStatuses.has(job.status)) {
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const [nextJob, nextEvents] = await Promise.all([getIngestionJob(job.id), getJobEvents(job.id)]);
      if (!cancelled) {
        setJob(nextJob);
        setEvents(nextEvents);
      }
    };
    const interval = window.setInterval(() => {
      void refresh().catch((refreshError) => {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Could not refresh job state.");
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [job]);
```

Teaching notes: no magic push connection — the page politely re-asks every 1.5 seconds ("polling"), stops when the job reaches a terminal status, and cleans up its timer when you leave the page.

## Interactive Elements

- [x] **Code↔English translations** — snippets A, B, C above.
- [x] **Quiz** — 4 questions, ALL debugging scenarios (this is the capstone quiz):
  1. "Chat returns: 'Retrieval index is unavailable' with a 503. Using the status-code vocabulary, what KIND of problem is this, and which two cast members would you check first?" → a dependency failure, not an app bug: check Qdrant (is it up? does the active collection exist?) and the active version pointer — not the React code.
  2. "An upload shows 'failed' with the message 'Check server logs for details.' Why won't the app just show the real error, and where does the real detail live?" → raw errors may leak paths/tracebacks (security); full diagnostics are kept in operator-side job metadata/events — pull the job's event log in Records.
  3. "A user swears the app 'hallucinated' an answer last Tuesday. What evidence exists to settle it?" → the stored assistant message with its citation rows → each links to a retrieval run and exact chunks; if citations exist, the passages are right there; a true no-evidence case would have been refused. The recorder settles arguments.
  4. "Your AI assistant has been stuck for 30 minutes guessing why uploads fail. Based on this course, write the ONE instruction you'd give it." → best answer shape: "Stop guessing — fetch GET /jobs/{id}/events for a failing job and diagnose from the recorded failure category." (Accept any answer that means: go read the paper trail.)
  Wrong-answer explanations should teach; keep tone warm.
- [x] **Pattern/feature cards** — the paper-trail cards (screen 1) and the Records-nouns cards (screen 2).
- [x] **Glossary tooltips** — log/event log, audit trail, status code, 404/500/503, exception, rollback, rate limit, 429, backoff, Retry-After, polling, terminal status, traceback, observability, healthcheck.
- [ ] Group chat / data flow — NO (Modules 1–4 carry those; this module's heroes are the scenario quiz and the playbook).

## Reference Files to Read

- `references/content-philosophy.md` — all
- `references/gotchas.md` — all
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Scenario Quiz", "Callout Boxes", "Glossary Tooltips", "Pattern/Feature Cards", "Icon-Label Rows"
- `references/design-system.md` → "Module Structure"

## Connections

- **Previous module:** Module 5 "Versions & Vaults" — guardrails against disasters; it bridges here with "ordinary things still break daily."
- **Next module:** none — this closes the course. The wrap-up recaps all six modules in one line each:
  1. The Question Journey — an app is a relay race of messages.
  2. Meet the Cast — five specialists on one call sheet.
  3. The Assembly Line — slow work happens on job tickets, behind the wall.
  4. Answers with Receipts — hallucination is fixed by architecture, not trust.
  5. Versions & Vaults — isolation, verification, refusal.
  6. When Things Break — debugging is reading the recorder, not guessing.
- **Tone/style:** ≤3 sentences per block, ≥50% visual. End warm and empowering, not corny.
