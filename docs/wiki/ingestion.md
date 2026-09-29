---
name: ingestion
description: The library plane's write path (specs/017-ingestion-pipeline, TASK-0024) — streamed multipart upload, the yauzl zip reader, page filtering/dedup, DDB-vs-generic parse routing, the structure-preserving chunker, the jobs queue's claim/lease/fencing/recovery, and the embedding obligation. Load for any upload/ingestion/job-status question.
kind: pipeline
sources:
  - apps/server/src/routes/library.ts
  - apps/server/src/library/ingest/jobs.ts
  - apps/server/src/library/ingest/worker.ts
  - apps/server/src/library/ingest/collect.ts
  - apps/server/src/library/ingest/zip.ts
  - apps/server/src/library/ingest/chunk.ts
  - apps/server/src/library/ingest/markdown.ts
  - apps/server/src/schema/jobs.ts
  - apps/server/drizzle/0003_dazzling_cargill.sql
  - apps/server/vitest.config.ts
  - apps/server/test/library/uploads.integration.test.ts
  - apps/server/test/library/jobs.integration.test.ts
  - apps/server/test/library/worker.integration.test.ts
  - apps/server/test/library/collect.test.ts
  - apps/server/test/library/zip.test.ts
verified_against: c732622ca88b9055779079909e330d034bb329d6
---

# Ingestion

The library plane's only **write** path (specs/017-ingestion-pipeline): an operator uploads a
zip, HTML page, or Markdown file at `POST /library/uploads`; a background worker in the same
process (started by [[server-entrypoint-and-app]]) extracts, parses, chunks, stores, and embeds
it, polling a `jobs` queue. Nothing here ever returns or logs book text (constitution VIII) —
only counts, ids, and fixed or caller-named error strings leave it.

## How it works

**Upload transport** (`routes/library.ts`, `POST /library/uploads`, operator-only). The file
part is streamed straight to disk through `busboy` — never `parseBody`/`formData`/
`arrayBuffer`/`text` — so a multi-hundred-MB body never sits in memory at once. Size is
enforced twice: an early `Content-Length` check over `uploadMaxBytes + 1 MiB` (see
[[configuration]]'s `UPLOAD_MAX_BYTES`), and, independently, busboy's `fileSize` limit plus a
`ByteCounter` transform for a body that lies about or omits `Content-Length` — both throw
`PayloadTooLargeError` (413 `too_large`, see [[error-contract]]). Any non-202 outcome deletes the partial temp file (`safeUnlink`,
awaited with the in-flight pipeline so a slow write can't recreate it after cleanup). `detectFormat` sniffs the first 4 bytes for a
zip signature, else the `.md`/`.markdown` extension, else HTML. `enqueueIngest` returns `409
conflict` (`jobs_active_book_key`, see [[database-schema]]) if that book already has an active
job — never two at once.

**Zip reader** (`zip.ts`), a thin wrapper over `yauzl`; callers never import `yauzl` directly.
`guardOpenable` rejects encrypted entries and any compression method but store/deflate before a
stream opens; each entry's declared size debits a shared `ZipBudget` (`EXTRACT_BUDGET_BYTES` =
2 GiB across one job's whole nested walk — the zip-bomb guard); an entry over `MAX_PAGE_BYTES`
(16 MiB) is rejected. `yauzl` doesn't verify CRC-32 itself, so every read/extract recomputes it
and throws `ZipError` on a mismatch; zip64 is supported natively.

Extracted nested zips get temp file names from `crypto.randomUUID()`, not a per-`walkZip`-call
counter. Found in T034's real-export spot check: LMoP nests a combined-book zip as the first
entry at its level (held open for the whole walk below it), whose own first inner chapter-zip
independently restarted its counter at 1 too — both wrote `<tmpDir>/1.zip`, and the inner write
truncated the file the outer read was still streaming from. A UUID can't collide at any depth
or sibling order. Reproduced without the real export in `collect.test.ts`.

**Filtering and dedup** (`collect.ts`). `isIgnoredEntry` drops `__MACOSX/`, `.DS_Store`, `._*`,
and any `*_files/` asset folder unextracted. A `.zip` entry recurses (up to `MAX_ZIP_DEPTH` =
3); `.html`/`.htm` is read; anything else counts `skipped`. Pages are sorted by nested path
(numeric-aware `Intl.Collator`) and deduped by sha-256 content hash — a book shipped as both
per-chapter zips and one combined zip ingests once. Zero surviving pages is a
`ValidationError`; a non-zip upload short-circuits to exactly one page.

**Parse routing** (`worker.ts`'s `runJob`). Markdown goes to `parseMarkdown` (a line-based
splitter producing the same `ParsedBook` shape/invariants as HTML; it deliberately flattens
setext headings, embedded HTML, and nested lists — see its module doc). Everything else goes
to [[ddb-parser]]'s `parseDdbExport`: the worker sniffs each page's raw text for D&D Beyond's
content-root marker (`p-article-content`); if present, default (DDB-specific) heading
detection runs, otherwise `{ headings: "all" }` so every `h1`-`h6` counts (generic HTML rarely
carries DDB's `heading-anchor` class).

**Chunker** (`chunk.ts`), pure and structure-preserving: consecutive blocks under the same
heading path merge into one chunk while staying under `CHUNK_MAX_CHARS` (2000 chars); a
`table`/`statBlock` block is always atomic, never merged or split. `ponytail:` a character
budget, not a tokenizer estimate; revisit if TASK-0029's benchmark shows the ratio too coarse.
Output re-uses [[ddb-parser]]'s `ParsedBook` shape, so `storeParsedBook` needs no special case.

**Jobs: schema, claim, lease, fencing, recovery.** `schema/jobs.ts`'s `jobs` table (see
[[database-schema]]) is deliberately **not** under `library_immutable` — rows update in place
as `status`/`stage`/`attempts`/`claim_token`/`heartbeat_at` advance. `claimJob` is one SQL
statement: `UPDATE ... WHERE id = (SELECT ... WHERE status='queued' OR (status='running' AND
heartbeat_at < now() - LEASE_MS) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING
...` — `SKIP LOCKED` lets concurrent claims never block each other, and folding "queued" and
"lease-expired running" into one `WHERE` needs no separate recovery path. `LEASE_MS` = 60s,
`HEARTBEAT_MS` = 10s (refreshed on an interval; a heartbeat returning `false` aborts the job's
`AbortController` — fenced out). Every write after a claim filters on `claim_token`, so a
worker whose lease expired and later wakes up can't corrupt a job another worker reclaimed —
the write updates zero rows and `requireStage` throws `FencedOutError`, which the outer loop
treats as "someone else owns this now", not a failure worth recording. A claim pushing `attempts` past `MAX_ATTEMPTS` (3) is immediately marked
`failed` ("abandoned 3 times…") with its upload file deleted right there — no worker runs that
claim's own cleanup. `startIngestWorker` runs one job at a time, polling every `POLL_MS` (2s)
or on `nudge()` (the upload route's `onEnqueued` callback), and sweeps orphaned upload
files/job dirs untouched 10+ minutes with no active job referencing them, as a backstop.

**Embedding obligation** (`worker.ts`'s `embedChunks`, the `embed` stage). Batches of
`EMBED_BATCH_SIZE` (256) chunks go through [[ai-gateway]]'s `embed()`, using the purpose named
by [[retrieval]]'s `RETRIEVAL_EMBED_PURPOSE` when boot wiring confirms it exists and does
`op: "embed"`; otherwise the job still **succeeds**, `embedding: { status: "skipped", reason:
"no embedding purpose configured" }` — a book stays `fts`-searchable with no AI provider
configured. `attachEmbeddings` validates every vector's dimension before any database call.

**Temp files.** Uploads land under `os.tmpdir()/the-stacks-uploads` (survives a `restart`, not
a `recreate` — a job whose file is then gone just fails with `"upload file missing"`). Each
running job gets its own `job-<id>/` subdirectory, removed on a terminal state or fence-out.
The upload route's own temp file is deleted on any non-202 outcome and, on success, by the same
terminal cleanup.

**`vitest.config.ts`'s `fileParallelism: false`** (server-wide — see [[test-suite]]).
`worker.integration.test.ts`'s background worker polls the shared `jobs` table; default
per-file parallelism let `jobs.integration.test.ts`'s `drainQueue()` helper claim and fail a
job this suite was waiting on — latent since Phase 1, invisible until a suite polled a shared
queue to a terminal outcome. Serializing files closes it with no behavior change.

## Connections

Calls [[ddb-parser]] and its own `parseMarkdown`; writes through [[library-schema]]'s
`storeParsedBook`/`attachEmbeddings`; embeds through [[ai-gateway]], matched to [[retrieval]]'s
configured purpose; its `jobs` table sits in [[database-schema]]; throws [[error-contract]]'s
`ValidationError`/`ConflictError`/`PayloadTooLargeError`/`NotFoundError`; mounted and started
by [[server-entrypoint-and-app]]; `UPLOAD_MAX_BYTES` is [[configuration]]'s. [[test-suite]]
covers the rest of `apps/server/test/`.

## Operational notes

`GET /library/jobs?limit` (1-100, default 20) and `GET /library/jobs/:id` (operator-only)
serialize through `JobStatusSchema`, which never exposes `uploadPath` — a malformed or unknown
id is `404 not_found`, not a validation error. `JobResult` carries counts (`pages`,
`duplicatePages`, `ignoredEntries`, `skippedEntries`, `chunkCount`) and the embedding outcome,
never book text.
