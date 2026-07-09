# Phase 0 Research: Extensible Ingestion Service

All decisions below resolve the unknowns in plan.md's Technical Context. Format:
Decision / Rationale / Alternatives considered. R-numbers are referenced from
plan.md, data-model.md, and contracts/.

## R1 — Archive storage: content-addressed `bytea` rows in Postgres

**Decision**: Store immutable source archives as `bytea` in a `source_archives` table,
primary-keyed by their sha256 (content-addressed), with `INGEST_MAX_UPLOAD_BYTES`
(default 25 MB) enforced at intake.

**Rationale**: One store means one backup story (the argument that retired Qdrant, D5)
and — decisive — *transactional intake*: archive row, source row, batch row, and job
enqueue commit atomically (the queue's own doc comment names this property as the point
of Postgres-as-queue). Sizes are bounded and modest (saved HTML pages and ZIPs); bytea
at ≤25 MB is comfortably inside Postgres norms. Content-addressing makes dedupe (FR-003)
a primary-key lookup and makes archives immutable by construction — there is no UPDATE
path.

**Alternatives considered**: Filesystem volume (second backup story, non-transactional
intake, worktree-teardown residue risk — rejected); S3-compatible object store (a sixth
service; single-operator scale can't justify it — rejected, Principle VI); Postgres
large objects (adds an API with vacuum/permission edge cases for no benefit at this
size — rejected).

## R2 — HTML parsing & extraction: `cheerio`; sanitization: `sanitize-html`

**Decision**: Plugins parse HTML with `cheerio` and produce display artifacts through
`sanitize-html` with a strict allowlist. Both dependencies are confined to
`@stacks/ingestion-plugins`.

**Rationale**: The DDB port is fundamentally CSS-selector knowledge (v2's
`ddb_import.py` encodes detection rules, selectors, and sanitization allowlists);
cheerio's selector engine maps that knowledge 1:1 into TS. `sanitize-html` is
server-side, allowlist-based, and needs no DOM emulation. Confinement to the plugins
package keeps parsing churn out of the pipeline core and lets the boundary checker
forbid parsing libs elsewhere.

**Alternatives considered**: `jsdom` + DOMPurify (full DOM emulation is heavyweight and
slower; DOMPurify wants a real-ish DOM — rejected); `node-html-parser` (faster but
weaker selector fidelity; selector fidelity *is* the ported asset — rejected);
`linkedom` (fine library, but cheerio's jQuery-style API matches the selector-rule
porting task better — rejected).

## R3 — Porting the D&D Beyond knowledge from git history

**Decision**: Recover v2's `ddb_import.py` via git history (`git log --all --
'*ddb_import*'` → `git show <sha>:<path>`), then port *rules* — detection heuristics,
selectors, content-kind classification, sanitization allowlist, artifact model — as
documented TS table-driven rules with fixture-first tests. No Python is executed or
vendored.

**Rationale**: ADR 0001 retired v2 to git history; doc 05 calls this ~760 lines "the
most valuable domain code in the repo" and says to carry rules deliberately. Table-driven
porting (selector → section kind mappings as data) makes the port reviewable against the
original and keeps the plugin honest about what it recognizes.

**Alternatives considered**: Re-deriving rules from live DDB pages (violates Principle I
— would require proprietary content in the loop — rejected); mechanical transliteration
of the Python (carries v2 idioms into the plugin; rules-as-data is clearer — rejected).

## R4 — Chunking policy: section-packing with atomic-kind guarantee, env-tunable

**Decision**: Pipeline-owned chunker packs contiguous sections into chunks against a
character budget (`CHUNK_TARGET_CHARS` default 4000, `CHUNK_OVERLAP_CHARS` default 400,
`CHUNK_MAX_CHARS` default 6000). Sections of atomic kinds (`stat_block`, `table`,
`spell_entry`) are never split: an atomic section larger than `CHUNK_MAX_CHARS` becomes
a single oversized chunk flagged `oversized: true` (documented policy, spec edge case).
Prose splits at paragraph, then sentence boundaries. Plugin `chunkingHints`
(`keepTogether` section-index groups, `preferBreakBefore`) are consumed as soft
constraints.

**Rationale**: FR-019 requires structure-awareness and eval-tunability (doc 06 treats
chunking as an eval variable); character budgets are deterministic and
tokenizer-agnostic — token counting varies by embedding model, and D14 forbids baking a
model's tokenizer into pipeline policy. Defaults follow v2-era practice (~1k tokens ≈
4k chars) and are starting points for the eval program, not conclusions.

**Alternatives considered**: Token-based budgets via a tokenizer lib (couples chunking
to one model family — rejected); fixed-size sliding window (destroys the structure the
normalized document exists to preserve; splits stat blocks — rejected); plugin-owned
chunking (doc 05 explicitly forbids it — not considered further).

## R5 — Full-text indexing: generated `tsvector` column + GIN on chunks

**Decision**: `chunks.fts` is a stored generated column
(`to_tsvector('english', content)`) with a GIN index, written by the same idempotent
insert as the vector.

**Rationale**: D5's stated payoff is hybrid FTS+vector retrieval from one store; a
generated column cannot drift from `content` and costs no application code. Language
config 'english' matches the corpus domain; making it configurable is retrieval-spec
territory.

**Alternatives considered**: Separate FTS table (drift risk, join cost, no benefit —
rejected); trigger-maintained tsvector (generated columns supersede this pattern —
rejected); external search engine (new service; Principle VI — rejected).

## R6 — ZIP handling: `yauzl` streaming at expand time, nested ZIPs refused

**Decision**: Intake stores the ZIP archive bytes and enqueues `ingest_batch_expand`;
the worker streams entries with `yauzl`, creating per-entry source rows + archives +
`ingest_source` jobs inside a transaction. Nested ZIPs and unsupported entries become
per-entry `skipped` outcomes with reasons (FR-004); zero ingestible entries completes
the batch honestly as "nothing ingestible". Entry count and per-entry size are capped
(`INGEST_MAX_BATCH_ENTRIES` default 200; per-entry cap = upload cap).

**Rationale**: Keeps intake < 2 s (SC-002) regardless of ZIP size; yauzl streams without
inflating the whole archive into memory and does not auto-recurse. Refusing nested ZIPs
bounds recursion by policy, matching the spec's edge case.

**Alternatives considered**: Expanding ZIPs synchronously at intake (breaks SC-002 for
large batches — rejected); `adm-zip` (in-memory inflation; fine at our caps but strictly
worse than streaming — rejected); allowing one nesting level (complexity without a user
story — rejected).

## R7 — Upload intake: `@fastify/multipart`, hash-while-stream, cap-then-commit

**Decision**: `POST /v1/uploads` uses `@fastify/multipart` (v9, Fastify 5 line) with
`limits.fileSize = INGEST_MAX_UPLOAD_BYTES`; the handler streams the file through a
sha256 hasher into a buffer, then runs one transaction: upsert archive by hash → create
source (or report duplicate, FR-003) → create batch row if ZIP → enqueue job → return
claim ticket. Type validation happens before buffering (extension + sniffed magic
bytes; declared-vs-actual mismatch is the spec's renamed-binary edge case → typed
`unsupported_type` refusal at the door).

**Rationale**: Multipart is the boring, curl-able, browser-form-native shape (FR-027's
UI posts the same endpoint); size cap enforcement inside the multipart stream refuses
oversized files without buffering them; hashing during the same pass means duplicates
are detected before any rows are written.

**Alternatives considered**: Raw `application/octet-stream` body (no filename/type
metadata channel, hostile to the HTML form — rejected); chunked/resumable upload
protocol (tus etc.) (caps make it unnecessary; Principle VI — rejected).

## R8 — Re-ingestion atomicity: generation-flip replacement

**Decision**: Every source carries `current_generation`. An ingest run writes sections
and chunks stamped with its target generation N; on success, the final stage flips
`sources.current_generation = N` in one UPDATE and deletes rows of generations < N.
Readers always filter on `generation = sources.current_generation`, so replacement is
atomic from their perspective (FR-023). A *retry* of the same job reuses the same target
generation, so deterministic IDs make its writes idempotent (SC-004); a *re-ingest* is a
new job with generation N+1.

**Rationale**: This is D4's surviving guardrail pattern (blue-green's useful half) shrunk
to one integer column: build aside, flip a pointer, clean up. It cleanly separates the
two "run it again" semantics the spec distinguishes — idempotent retry (FR-008) vs
replacing re-ingest (FR-023).

**Alternatives considered**: Delete-then-rewrite in one transaction (holds a long
transaction across embedding — an HTTP call to the sidecar mid-transaction — rejected);
shadow tables with rename (heavier machinery for the same pointer-flip idea — rejected);
soft-delete flags (readers must reason about tombstones forever — rejected).

## R9 — Deterministic identity scheme

**Decision**: `source.fingerprint = sha256(archive bytes)` (= archive PK).
`chunk.id = sha256(corpus_id : source_fingerprint : plugin_name : plugin_version :
generation : chunk_index : sha256(chunk_content))`, computed in `@stacks/core`
(alongside the existing `deriveVectorId` doctrine). Chunk embedding rows reuse
`chunk.id`. Writes are `ON CONFLICT DO NOTHING`.

**Rationale**: FR-008/FR-021 — identity derived from content and position makes any
replay a no-op, and including generation keeps retry-idempotency (same job → same IDs)
compatible with re-ingest-replacement (new generation → new IDs, old rows swept after
flip, R8). Including plugin identity means a plugin-version change can never silently
collide with the old version's rows (FR-016's re-ingestion trigger).

**Alternatives considered**: Random UUIDs + uniqueness constraints on natural keys
(pushes idempotency into constraint-violation handling — rejected); content-hash-only
IDs without position (duplicate paragraphs in one source would collide — rejected).

## R10 — Job granularity: one job per source, single-pass stages; expand job for ZIPs

**Decision**: Two job kinds. `ingest_batch_expand` (R6) fans a ZIP out into sources.
`ingest_source` runs detect→extract→transform→chunk→embed→index for one source in one
job execution, recording an event per stage transition; failure at any stage fails the
job (typed cause), and queue retry re-runs from detect — cheap because every write is
idempotent (R9) and the expensive stage (embed) skips already-indexed chunks.

**Rationale**: Matches the skeleton's proven shape (worker registry dispatches whole
handlers; `kind` is the routing key — no loop changes needed). Stage-resume machinery
(job-per-stage chaining) buys nothing at single-operator scale and multiplies queue
states; per-stage *events* give the observability without per-stage *jobs*.

**Alternatives considered**: Job-per-stage pipelines (state-machine complexity, no user
story — rejected); one job per batch (a single bad entry would fail-retry the whole
batch — rejected).

## R11 — Ingestion events: new append-only table, sole-writer construction

**Decision**: `ingestion_events` mirrors the `skeleton_check_events` pattern exactly:
insert-only, written solely by `recordIngestionEvent()` in `@stacks/db`, keyed by
`source_id` (nullable `batch_id` for expand-stage events), carrying
`stage`, `event` (started/completed/failed/skipped), `ok`, `detail` (scrubbed), and
`duration_ms`. The skeleton's table is left untouched.

**Rationale**: The append-only-by-construction doctrine (AGENTS.md names it an
invariant) generalizes by *copying the construction*, not by widening the old table's
meaning — skeleton checks and ingestion runs are different lifecycles with different
keys. Event vocabulary is a contract deliverable (contracts/events.md).

**Alternatives considered**: One generic `events` table for everything (loses typed
foreign keys and invites schema-less sprawl — rejected); reusing skeleton_check_events
(wrong key, wrong seam vocabulary — rejected).

## R12 — Operator surface: two RR7 routes, loader-driven polling

**Decision**: `library.upload.tsx` (multipart form posting through
`app/lib/api.server.ts` — the one legal API path) and `library.uploads.$ticket.tsx`
(status + event trail from `GET /v1/uploads/:ticket`, auto-revalidating on an interval
while the job is non-terminal). No streaming, no websockets.

**Rationale**: FR-027 asks for the minimal human-completable journey; RR7
loader/revalidation is the boring native mechanism, and the ticket view is
URL-addressable state (Principle V). Streaming progress belongs to the conversations
spec's SSE groundwork, not here.

**Alternatives considered**: SSE progress push (new transport machinery for a page the
operator glances at — rejected); building into the future Records surface now (FR-025/
FR-026-style scope fence: Records is its own spec — rejected).

## R13 — Package & boundary layout

**Decision**: Pipeline core in new `@stacks/ingestion` (imports core, db,
ingestion-contract; owns registry dispatch, chunking, embed client, indexing, stage
driver). Plugins in new `@stacks/ingestion-plugins` (imports ONLY
`@stacks/ingestion-contract` + its parsing libs). Contract + conformance suite in
`@stacks/ingestion-contract` (imports nothing internal). `scripts/check-boundaries.mjs`
gains rules: (a) ingestion-plugins must not import `@stacks/db`, `@stacks/core`, or any
HTTP/model client; (b) cheerio/sanitize-html/yauzl may appear only under
ingestion-plugins (yauzl exception: the worker's expand handler); (c) existing
no-hardcoded-model rule covers the new packages automatically.

**Rationale**: FR-014's "plugins never touch DB/embedding/providers" becomes a
build-time impossibility instead of a review convention — the same
enforced-by-construction move the skeleton made for web→db (FR-019 of 007). The
conformance suite living in the contract package means a future out-of-tree plugin
(deferred by the in-tree assumption) could still import and pass it unchanged.

**Alternatives considered**: Plugins as a folder inside `@stacks/ingestion` (boundary
becomes a lint convention instead of a package wall — rejected); one plugin package per
ingester (three packages today, ceremony without isolation benefit; revisit if
out-of-tree plugins ever arrive — rejected).
