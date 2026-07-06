# Module 3: The Assembly Line

Write file: `modules/03-the-assembly-line.html` containing ONLY `<section class="module" id="module-3">…</section>`. No `<html>`, `<head>`, `<body>`, `<style>`, or `<script>` tags.

## Course-wide context (applies to every module)

**The app being taught:** "The Stacks" is a self-hosted web app for tabletop RPG (TTRPG) game masters. The operator uploads rulebooks and notes (Markdown, text, HTML, EPUB, saved-webpage ZIPs), then asks questions in chat; answers cite exact uploaded passages. Tech: React web app, Python FastAPI backend, background worker, Postgres, Qdrant (vector database), OpenAI.

**Learner:** a "vibe coder" — zero CS background. Tooltip every technical term aggressively. Tone: smart friend.

**Consistent actor set:** Web app 🖥️, API 🚪, Worker 🛠️, Postgres 🗃️, Qdrant 🧭, OpenAI 🤖.

**Course title:** "Inside The Stacks". Accent: amber/gold (pre-configured).

## Teaching Arc

- **Metaphor:** A factory intake line with paper job tickets. The API is the receiving dock: it inspects the crate (file validation), takes a fingerprint (SHA-256), writes a **job ticket** and drops it on a spike. The Worker walks the floor, grabs the next ticket, and runs the piece through stations: *parse* (unpack the crate) → *chunk* (cut into labeled pieces) → *embed* (measure each piece into numbers) → *index* (warehouse the measurements). Every station stamps the ticket, so anyone can see exactly where a piece is — or where it jammed.
- **Opening hook:** "You drop a 300-page rulebook on the Upload page and the response comes back in under a second. The book is NOT processed yet — you've been handed a claim ticket. The real work happens behind the wall."
- **Key insight:** Slow work should never happen while a user waits. The upload endpoint only *accepts and records*; a completely separate program does the heavy lifting later, and the ticket's `status` column is how everyone (including the progress bar you watch) knows what's going on.
- **Why should I care:** "Make it a background job" is one of the highest-leverage sentences you can say to an AI assistant — and when an upload sticks at 'queued', you'll know exactly which part of the machine to poke.

## Screens (suggested, 6)

1. **The receiving dock.** Metaphor intro + the claim-ticket idea. Mention the file rules: supported types (.md, .txt, .html, .epub, .zip) or the dock rejects the crate with HTTP **415** ("Unsupported Media Type" — tooltip it).
2. **HERO VISUAL — data flow animation** of a file moving through the line (see below).
3. **The job ticket + the patient Worker.** Code↔English: snippet A (worker loop) and snippet B (claiming a ticket safely). Callout: "There's no fancy queue system here — the 'queue' is just a database table with a status column. Boring is a feature." Second aha: `SKIP LOCKED` means two workers can never grab the same ticket — no duplicated work, by construction. Show the status pipeline as step badges: queued → processing → chunking → awaiting_embedding → embedding → indexing → completed (failed = the sad siding).
4. **The cutting station (chunking).** Why cut at all: the AI can only read a few pages at a time, and search works best on small passages. Code↔English: snippet C. Emphasize it prefers cutting at paragraph breaks, then sentence ends, then spaces — like cutting fabric along the seams — and keeps a 160-character overlap so no thought is severed mid-sentence.
5. **Measuring & warehousing (embed + index).** Code↔English: snippet D (the embedding request) and snippet E (storing vectors in Qdrant). Explain embedding plainly: a list of 1,536 numbers that acts like GPS coordinates for *meaning* — passages about similar things get nearby coordinates. Aha callout on snippet F (deterministic IDs): re-running the same job overwrites the same warehouse slots instead of creating duplicates — "idempotent" (tooltip!) means safe to retry.
6. **Quiz.**

## Code Snippets (pre-extracted — use verbatim, never edit)

### Snippet A — the Worker's whole life (a polite infinite loop)
File: `apps/worker/worker.py` (lines 27–35) — Python

```python
while running:
    with SessionLocal() as db:
        job = process_next_job(db)
    if job is not None:
        print(f"Processed ingestion job {job.id}; status={job.status}", flush=True)
    if run_once:
        break
    time.sleep(poll_seconds)
```

Teaching notes: check the pile, do one job if there is one, nap 5 seconds, repeat forever.

### Snippet B — claiming the next ticket without fighting over it
File: `apps/api/app/ingestion.py` (lines 468–475) — Python

```python
statement = (
    select(IngestionJob)
    .where(IngestionJob.status == "queued")
    .order_by(IngestionJob.created_at, IngestionJob.id)
    .with_for_update(skip_locked=True)
    .limit(1)
)
job = db.scalars(statement).first()
```

Teaching notes: oldest queued ticket first; `with_for_update(skip_locked=True)` = "put your hand on the ticket so nobody else can take it — and if someone's hand is already on one, skip it."

### Snippet C — cutting along the seams
File: `apps/api/app/ingestion.py` (lines 1234–1242) — Python

```python
hard_end = min(start + MAX_CHUNK_CHARS, len(text))
end = hard_end
if hard_end < len(text):
    paragraph_break = text.rfind("\n\n", start, hard_end)
    sentence_break = text.rfind(". ", start, hard_end)
    whitespace_break = text.rfind(" ", start, hard_end)
    end = max(paragraph_break, sentence_break + 1 if sentence_break != -1 else -1, whitespace_break)
    if end <= start:
        end = hard_end
```

Teaching notes: `MAX_CHUNK_CHARS` is 1200 — aim for at most 1200 characters, but back up to the nearest paragraph break (`\n\n`), else sentence end (`. `), else space, so chunks read like complete thoughts. (The next line of the file, not shown, starts the following chunk 160 characters *before* this one ended — the overlap.)

### Snippet D — turning text into meaning-numbers
File: `apps/api/app/embeddings.py` (lines 116–121) — Python

```python
response = httpx.post(
    "https://api.openai.com/v1/embeddings",
    headers={"Authorization": f"Bearer {api_key}"},
    json={"model": model, "input": batch, "dimensions": dimensions, "encoding_format": "float"},
    timeout=60,
)
```

Teaching notes: a plain HTTP request to OpenAI: "here's a batch of passages, send back their coordinates." The API key rides in the header like a membership card.

### Snippet E — warehousing the vectors, 25 at a time
File: `apps/api/app/qdrant_index.py` (lines 73–81) — Python

```python
response = httpx.put(
    f"{self.url}/collections/{self.collection}/points?wait=true",
    json={"points": [
        {"id": point.id, "vector": point.vector, "payload": point.payload}
        for point in batch
    ]},
    timeout=self._UPSERT_TIMEOUT,
)
```

Teaching notes: each "point" = one chunk's coordinates (`vector`) plus a luggage tag (`payload`: which file, which section, which job). `?wait=true` = don't hang up until it's actually shelved.

### Snippet F — the same slot every time (idempotency)
File: `apps/api/app/ingestion.py` (lines 921–922) — Python

```python
def deterministic_point_id(chunk: DocumentChunk) -> str:
    return str(uuid5(NAMESPACE_URL, f"thestacks:{chunk.upload_id}:{chunk.ingestion_job_id}:{chunk.id}"))
```

Teaching notes: the warehouse slot number is *calculated* from the chunk's identity, not invented randomly — so a retry overwrites instead of duplicating.

## Interactive Elements

- [x] **Data flow animation** (MANDATORY here). Actors: Web app 🖥️, API 🚪, Postgres 🗃️, Worker 🛠️, OpenAI 🤖, Qdrant 🧭. Steps:
  1. Web app → API: "One rulebook PDF— kidding, .zip archive, coming in!"
  2. API: "Inspecting: supported type? size OK? Fingerprinting the bytes (SHA-256)." (self)
  3. API → Postgres: "New job ticket: status = queued"
  4. API → Web app: "Accepted! Here's your claim ticket number." (user is FREE to leave)
  5. Worker → Postgres: "Any queued tickets? …Mine now. Status = processing."
  6. Worker: "Parsing the file, cutting it into ~1,200-character chunks along the seams" (self)
  7. Worker → OpenAI: "Batch of chunks → coordinates, please"
  8. Worker → Qdrant: "Shelving 25 points at a time"
  9. Worker → Postgres: "Ticket stamped: completed ✅ (every stage logged as an event)"
- [x] **Code↔English translations** — snippets A–F (A+B together, C alone, D+E together, F in a callout or mini-block).
- [x] **Quiz** — 3–4 questions, debugging/architecture:
  1. (Debugging) "An upload has said 'queued' for ten minutes. Chat still works fine. What's your first suspect?" → the Worker isn't running — the API happily writes tickets whether or not anyone collects them.
  2. (Debugging) "Uploading a .docx file returns an error instantly. Is that a bug?" → No — the dock rejects unsupported types on purpose with 415; the fix is converting the file (or teaching the parser a new type), not 'fixing' the error.
  3. (Architecture) "You ask an AI assistant to add support for .pdf files. Which stations need work — and which don't?" → parsing needs a new parser; chunk/embed/index stations are format-agnostic and untouched. (This is the payoff of an assembly line: stations are independent.)
  4. (Tracing) "A job died overnight between 'chunking' and 'completed'. Why is that not a disaster?" → statuses make it resumable — a worker can pick up an `awaiting_embedding` ticket and continue without re-parsing; deterministic IDs make retries safe.
- [x] **Glossary tooltips** — background job, queue, polling, database table/row, status, SHA-256/fingerprint/hash, parse, chunk, embedding, vector, index, payload, HTTP 415, idempotent, batch, API key, ZIP.
- [ ] Group chat — NO (Modules 2 and 4 have them).

## Reference Files to Read

- `references/content-philosophy.md` — all
- `references/gotchas.md` — all
- `references/interactive-elements.md` → sections: "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Message Flow / Data Flow Animation", "Callout Boxes", "Glossary Tooltips", "Numbered Step Cards"
- `references/design-system.md` → "Module Structure"

## Connections

- **Previous module:** Module 2 "Meet the Cast" — introduced the five services; it ends by promising to follow the Worker into the back room. Open on that handoff.
- **Next module:** Module 4 "Answers with Receipts" — how a question searches everything this line produced, and how citations are policed. Bridge: "The warehouse is stocked. Next: what happens when a question comes looking."
- **Tone/style:** flow animation needs `data-steps='[...]'` JSON. Text blocks ≤3 sentences, ≥50% visual per screen.
