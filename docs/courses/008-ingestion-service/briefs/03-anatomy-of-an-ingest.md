# Module 3: Anatomy of an Ingest

Write to: `modules/03-anatomy-of-an-ingest.html` — `<section class="module" id="module-3">` only.
THIS IS THE COURSE CENTERPIECE — it carries the mandatory GROUP CHAT animation and a
data-flow animation. Give it the most visual weight of any module.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
`accept-then-async` ("the API's only job is validate+archive+enqueue and answer — all real
work happens off a queue, Principle IV"), `stage driver` ("the one function that walks a
source through every pipeline stage and records an event at each transition"), `deterministic
id` ("an id computed from content+position, never random — makes retries idempotent for
free, research R9"), `generation` ("an integer stamped on every derived row so re-ingestion
can replace safely — full story in Module 4").

## Teaching Arc
- **Metaphor:** A tracer round, same device 007 used for the skeleton check — but this
  time the round travels through EIGHT seams instead of six, and leaves behind not just an
  event trail but a searchable, citable passage. "Watch the bullet, then look at what it built."
- **Opening hook:** "You submit a saved D&D Beyond page. 20 milliseconds later you have a
  ticket. One second later — with zero further input from you — that page is four
  classified sections, one embedded, indexed passage, and a complete stage-by-stage trail
  you can read like a transcript."
- **Key insight:** `extract` and `transform` are ONE plugin call observed as TWO recorded
  stages — the driver deliberately keeps doc 05's stage vocabulary visible even though the
  code seam is a single function call. The trail is what you can trust; it's not a log
  line, it's the durable record of what actually happened, replayable after the fact.
- **Why should I care?:** This exact driver shape — detect → extract → transform → chunk →
  embed → index → commit, one typed event per transition — is what makes an ingestion job
  debuggable in production without SSH: read the trail, know exactly which seam failed and
  why.

## Canonical vocabulary (use identically everywhere in this module — the REAL stage names,
lowercase, exactly as they appear in the event trail):
`intake` → `detect` → `extract` → `transform` → `chunk` → `embed` → `index` → `commit`
(each stage except `intake`/`commit` emits `started` then `completed`/`failed`)

## Screens (6)
1. Hook + **HERO: group chat animation** (mandatory — see Interactive Elements), using the
   REAL goblin-page.html run from this cycle's live validation (ticket
   `f513d44f-386b-407d-bf21-9eb046ac7707`).
2. The accept side — Code↔English on Snippet A (the intake route's refusal-first shape).
   Callout ("aha!"): *every refusal in this function happens BEFORE a single row is
   written — sniff, size-cap, corpus lookup, all upstream of the transaction. A 415 always
   means zero residue.*
3. The stage-driver skeleton — Code↔English on Snippet B (the `stage()` helper). Callout:
   *one function wraps EVERY stage identically: started event, timer, try/catch that turns
   any failure into a `failed` event + scrubbed `lastError` + re-throw. No stage's failure
   path was hand-written twice.*
4. **Data-flow animation** (screen HERO #2) of the real trail from Snippet C — label each
   beat with its exact stage:event name so the animation IS the trail, timed with the real
   durationMs values.
5. Deterministic identity, briefly — Snippet D (chunk id derivation, referenced not
   re-explained — full treatment is Module 4). Callout: *content + position + plugin +
   generation, hashed — the SAME job re-run twice writes the SAME id twice. `ON CONFLICT DO
   NOTHING` makes the second write a no-op automatically.*
6. Quiz + handoff to Module 4: "That run committed at generation 1. What happens the day
   this plugin ships a bug fix and every source it touched needs to be redone?"

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `apps/api/src/ingestion/routes.ts` (lines 41-79, refusal-first shape;
quote the full handler through the ZIP/source branch point)
```ts
  app.post("/api/uploads", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      throw new DomainError({
        class: "unsupported_type",
        message: "Upload requires exactly one multipart 'file' field.",
      });
    }

    let bytes: Buffer;
    try {
      bytes = await file.toBuffer();
    } catch {
      // @fastify/multipart aborts the buffer once limits.fileSize trips.
      throw new DomainError({
        class: "unsupported_type",
        message: `File exceeds the upload size limit (${maxUploadBytes} bytes, INGEST_MAX_UPLOAD_BYTES).`,
      });
    }

    // Magic bytes + extension — the client's declared content type is never
    // trusted (renamed-binary edge case sniffs as null and is refused here).
    const sniffed = sniffMediaType(file.filename, bytes);
    if (!sniffed) {
      throw new DomainError({
        class: "unsupported_type",
        message: `Unsupported file type: "${file.filename}". Supported: HTML, Markdown, plain text, ZIP. (PDF is deliberately unsupported in v3.)`,
      });
    }

    const corpusField = file.fields["corpus"];
    const corpusName =
      corpusField && "value" in corpusField && typeof corpusField.value === "string"
        ? corpusField.value
        : "default";
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = ${corpusName}`);
    if (!corpus) {
      throw new DomainError({ class: "unknown_thing", message: `No such corpus: "${corpusName}".` });
    }
```

**Snippet B** — File: `packages/ingestion/src/ingest-source.ts` (lines 97-131, the shared
stage-wrapper)
```ts
  /** Runs one stage: started/completed events, timing, and the failure
   * ritual (failed event + scrubbed last_error + status flip) in one place. */
  async function stage<T>(
    name: IngestionStage,
    body: () => Promise<{ result: T; detail?: Record<string, unknown> }>,
    options: { skipStarted?: boolean } = {},
  ): Promise<T> {
    if (!options.skipStarted) await event(name, "started");
    const startedAt = Date.now();
    try {
      const { result, detail } = await body();
      await event(name, "completed", detail, Date.now() - startedAt);
      return result;
    } catch (cause) {
      const error =
        cause instanceof DomainError
          ? cause
          : new DomainError({
              class: "internal_fault",
              seam: name,
              message: `Unexpected failure in ${name} stage.`,
              cause,
            });
      await event(name, "failed", { class: error.class, message: error.message }, Date.now() - startedAt);
      await db
        .update(sources)
        .set({
          status: "failed",
          lastError: { class: error.class, stage: name, message: error.message },
          updatedAt: new Date(),
        })
        .where(sql`${sources.id} = ${sourceId}`);
      throw error;
    }
  }
```

**Snippet C** — the REAL event trail, verbatim from this cycle's live validation (evidence.md,
ticket `f513d44f-386b-407d-bf21-9eb046ac7707`, upload of `goblin-page.html`):
```text
intake   :completed  (0ms   ) byteSize=2862 mediaType=text/html duplicate=false
detect   :started
detect   :completed  (20ms  ) plugin=ddb-saved-html version=1.0.0 confidence=0.95
extract  :started
extract  :completed  (13ms  )
transform:completed  (1ms   ) sections=4 artifacts=5 warnings=0 contractVersion=1.0.0
chunk    :started
chunk    :completed  (0ms   ) chunks=1 oversized=0 targetChars=4000 overlapChars=400
embed    :started
embed    :completed  (121ms ) model=local-sidecar/sentence-transformers/all-MiniLM-L6-v2 embedded=1 batches=1
index    :started
index    :completed  (4ms   ) inserted=5 conflictNoops=0
commit   :completed  (1ms   ) generation=1 sweptSections=0 sweptChunks=0
```

**Snippet D** — File: `packages/ingestion/src/ingest-source.ts` (lines 270-290, deterministic
identity — reference only, full teaching is Module 4)
```ts
  // Deterministic identities for everything we are about to write (R9).
  const idInput = {
    sourceFingerprint: source.fingerprint,
    pluginName: decision.plugin.name,
    pluginVersion: decision.plugin.version,
    generation: targetGeneration,
  };
```

## Interactive Elements
- [x] **Group chat animation (MANDATORY, HERO of screen 1)** — actors: Operator 🧑‍💻, Web,
  API, Queue (jobs table), Worker, Registry, Sidecar, Postgres. Flow (use the REAL numbers
  from Snippet C):
  1. Operator → Web: "Upload goblin-page.html"
  2. Web → API: `POST /api/uploads` (multipart)
  3. API → Postgres: sniff + hash + one transaction (archive, source, job) · API → Web:
     "201 — ticket f513d44f…, queued" (< 2s, before any parsing)
  4. Web → Operator: redirect to the ticket page (starts polling)
  5. Worker → Queue: claims the `ingest_source` job
  6. Worker → Registry: "who claims this?" · Registry → Worker: "ddb-saved-html, 0.95"
     (20ms)
  7. Worker → itself: extract+transform (13ms + 1ms) — 4 sections, 5 artifacts
  8. Worker → itself: chunk (0ms) — 1 chunk, 0 oversized
  9. Worker → Sidecar: "embed this chunk" · Sidecar → Worker: vector back (121ms)
  10. Worker → Postgres: index (4ms) — 5 rows inserted · commit (1ms) — generation 1 flips
  11. Web → Operator: poll flips to "ingested ✓" with plugin, confidence, section/chunk
      counts, full trail
- [x] **Data-flow animation** (screen 4) — actors: API, Queue, Worker, Registry, Sidecar,
  Postgres. Steps keyed EXACTLY to Snippet C's stage:event lines, each step labeled with
  its stage name and real durationMs. This animation IS the trail — no invented framing.
- [x] **Code↔English translations** — Snippets A and B in full; C and D as annotated
  data/reference blocks (not translated line-by-line — they're evidence, not logic to
  parse).
- [x] **Quiz** — 3 questions:
  1. "Snippet C shows `extract:completed` and then `transform:completed` — but the plugin
     contract has only ONE `transform()` method. Why two stages?" (extract/transform are
     one plugin call observed as two recorded stages — the driver emits `extract:started`
     before invoking and `transform:completed` after invariant validation, keeping the
     stage vocabulary visible even though the code seam is a single function.)
  2. "The worker process is killed right after `chunk:completed` but before `embed:started`
     is recorded. What happens on retry?" (The queue retries the job from `detect` again;
     because every write from `detect` onward is either idempotent or hasn't happened yet,
     the retry reproduces the exact same trail — nothing is duplicated. Proven in Module
     4's retry-vs-re-ingest distinction.)
  3. "Why does `stage()` (Snippet B) write BOTH a `failed` event AND `sources.lastError` on
     any exception?" (The event trail is the authoritative, append-only HISTORY; `lastError`
     is a derived convenience for a quick status read — Module 5 shows why that distinction
     matters for scrubbing.)
- [x] **Glossary tooltips** — the four domain terms from the AUDIENCE OVERRIDE.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/interactive-elements.md` → "Group Chat Animation", "Message Flow / Data Flow
  Animation", "Code ↔ English Translation", "Multiple-Choice Quiz", "Callout Boxes",
  "Glossary Tooltips".

## Connections
- **Previous:** Module 2 "Detection Dispatch" — this module's `detect` stage IS that
  module's decision, now in context of the full run.
- **Next:** Module 4 "Generation-Flip" — what happens when this exact source needs to run
  again (retry, or a plugin upgrade).
- **Tone/style:** deep blue/indigo accent (the centerpiece gets its own strong color,
  distinct from Modules 1-2's violet); actors Web/API/Queue/Worker/Registry/Sidecar/Postgres;
  every id/timing in this module is the REAL run from evidence.md — do not invent smoother
  numbers.
