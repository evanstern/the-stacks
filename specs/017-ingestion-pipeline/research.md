# Research: Ingestion pipeline

Grounding: `docs/wiki/{ddb-parser,library-schema,ai-gateway,server-entrypoint-and-app,
configuration,error-contract,session-auth,migrations}.md`; decision-0005 (doc-0001);
architecture A9; TASK-0026 `specs/015-hybrid-retrieval/contracts/retrieval.md` (branch
`task-0026-hybrid-retrieval`); `unzip -l`/`-Zv` listings of the operator's real exports
(never copied).

## Observed export facts (2026-09-29, `unzip -Zv`)

| Export | Delivered as | Size | Entries | Methods | Notes |
|---|---|---|---|---|---|
| PHB | directory of 39 per-chapter zips | 109 MB | ~75 per chapter | deflate, stored | 1 HTML + `*_files/` assets per chapter |
| LMoP | directory of 7 per-chapter zips **plus** a combined zip of the same 7 | 86 MB | — | deflate, stored | combined zip holds `.DS_Store`, `__MACOSX/`; its `07 - Appendix B` zip is 208 bytes, a directory only |
| DMG | one zip of 22 per-chapter zips | 119 MB | 23 | deflate, stored | zip of zips |
| MM | one zip of chapter folders | 128 MB (307.6 MB inflated) | 3,219 | 3,158 deflate, 61 stored | 30 HTML pages (13.1 MB total); `__MACOSX/`, `.DS_Store`, `*_files/` |
| XGtE | one zip of 14 per-chapter zips | 43 MB | 15 | stored | never run through the parser |

No export uses zip64, encryption, data descriptors, or a method other than stored (0) and
deflate (8). Every entry count is under 65,535. Asset folders are named `<page>_files/` and
hold extensionless files (`background`, `jquery`, `cobalt`); they must be excluded by folder,
not by extension. HTML pages are at most ~1 MB each.

## R1 — Upload transport: raw request body, streamed to disk

**Decision**: `POST /library/uploads?book=<name>&filename=<name>` with the file as the raw
request body (any `Content-Type`). The handler reads `c.req.raw.body` (a web
`ReadableStream`), converts it with `Readable.fromWeb`, and `stream/promises.pipeline`s it
through a byte-counting `Transform` into `fs.createWriteStream`. The counter throws when the
running total exceeds `UPLOAD_MAX_BYTES`. A `Content-Length` over the ceiling is refused
before reading a byte.

**Rationale**: `@hono/node-server` 2.1.1 exposes the incoming request as
`Readable.toWeb(incoming)` (pull-based, backpressured; verified in its `dist/index.mjs`), so
nothing is buffered unless a handler calls `parseBody`/`arrayBuffer`. The SPA can send a
`File` with `fetch(url, { method: "POST", body: file })`, which streams; `curl -T file` and
`--data-binary @file` work for agents and the merge-condition run. Stdlib only.

**Alternatives rejected**:
- Hono `parseBody` / `c.req.formData()`: buffers the whole body (the runbook's stated reason).
- A streaming multipart parser (`busboy`, `@fastify/busboy`): a new runtime dependency to
  carry one field (the book name) that a query parameter carries for free.
- Hand-rolled multipart parsing: boundary scanning across chunk edges is real code with real
  bugs, for no gain over a raw body.

**Node server timeout**: Node's `http.Server.requestTimeout` defaults to 300 s, which would
cut a 310 MB upload on a slow link. Pass `serverOptions: { requestTimeout: 60 * 60 * 1000 }`
to `serve()` in `index.ts`. `ponytail:` fixed one-hour ceiling; make it config when a
self-hoster reports a slower link.

## R2 — Zip reading: a minimal stdlib reader (no dependency)

**Decision**: `apps/server/src/library/ingest/zip.ts`, ~150 lines on `node:zlib` and
`node:fs/promises`. It reads the End-of-Central-Directory record, walks the central
directory, and for each wanted entry reads the local header and inflates the payload with
`zlib.inflateRaw` (async, `maxOutputLength` = declared size), then checks `zlib.crc32`
(Node ≥ 22.2; the repo pins Node 22, the image is `node:22-alpine`). The reader works over a
`{ size, read(offset, length) }` source, so the outer zip is read from its file handle by
offset (never loaded whole) and an inner zip is read from a `Buffer`.

It refuses, with a named reason: zip64 markers (`0xFFFF`/`0xFFFFFFFF` fields), encrypted
entries (flag bit 0), methods other than 0/8, a CRC mismatch, an entry whose inflated size
differs from the declared size, and nesting deeper than 3.

**Rationale**: every real export uses exactly the subset above (table). The job needs
read-only, whole-entry, in-memory access to a few dozen ~1 MB pages; the central directory
gives sizes up front, so data descriptors never matter. No extraction to disk means no path
traversal surface. `maxOutputLength` plus the declared-size check is the zip-bomb guard.

**Alternatives considered**:
- `yauzl` (3.x, deps `buffer-crc32`, `pend`): mature, handles zip64. Rejected for now:
  a runtime dependency plus two transitive ones for a subset stdlib covers. **Upgrade
  path**: if a real export needs zip64 or another method, swap `zip.ts`'s internals for
  `yauzl` behind the same function signature.
- `fflate` / `adm-zip` / `jszip`: whole-archive-in-memory APIs; contradict AC #7.
- Shell `unzip` in the image: busybox `unzip` exists on alpine, macOS has Info-ZIP; two
  different tools across host tests and container, output parsing, and extraction to disk.
  Rejected.

## R3 — Entry filtering and page order

**Decision**: normalize each entry name to `/` separators. Ignore when any path segment is
`__MACOSX`, the base name is `.DS_Store`, the base name starts with `._`, or any segment
ends with `_files` (saved-page asset folder). Ignore directory entries. Of the rest: `.zip`
→ recurse; `.html`/`.htm` → page; `.md`/`.markdown` (top-level upload only) → page;
anything else → skipped without inflating. Count ignored and skipped entries in the result.

Pages are sorted by their full nested path (`outer/inner.zip/page.html`) with
`Intl.Collator(undefined, { numeric: true })`, then de-duplicated by sha-256 of their bytes
(LMoP's directory form carries every chapter twice).

**Rationale**: chapter-number prefixes ("02 - …", "10 - …") give the right order under
numeric collation. MM's letter folders sort alphabetically, so "Appendix A" lands between
"A" and "B"; anchors stay valid regardless of order, so this is cosmetic. `ponytail:` no
book-specific ordering; add a manifest when a reader needs print order.

## R4 — Format detection and the three parse paths

**Decision**: detect by content, then name. A body starting with `PK\x03\x04` or
`PK\x05\x06` is a zip. Otherwise `.md`/`.markdown` is Markdown and anything else is a single
HTML page. Within the collected HTML pages:

- If any page contains the D&D Beyond content root (`.p-article-content`, from
  `ddb/selectors.ts`), call `parseDdbExport` as today.
- Otherwise call `parseDdbExport` with a new option `headings: "all"`, so every `h1`–`h6`
  starts a section (today only `h1` and `heading-anchor` headings do). The walk already
  falls back to `<body>` and strips `nav`/`header`/`footer`/`script`/`style`.
- Markdown goes to a new `ingest/markdown.ts`, a line-based block splitter: ATX headings
  (`#`…`######`) push the path stack; a fenced code block (```` ``` ```` / `~~~`) is one
  `prose` block; consecutive `|` lines form one `table` block; consecutive list-item lines
  form one `list` block; blank-line-separated paragraphs form `prose` blocks. It emits the
  same `ParsedBook` shape (text joined by `\n\n`, UTF-16 anchors) so the store path is
  shared.

**Alternatives rejected**: a Markdown library (`marked`, `micromark`, `markdown-it`): a
runtime dependency for five block rules. A separate generic HTML walker: duplicates
`walk.ts`; one option flag is smaller. `ponytail:` Setext headings, HTML embedded in
Markdown, and nested lists are flattened; add when a real Markdown book needs them.

## R5 — Chunking

**Decision**: `ingest/chunk.ts` exports a pure `chunkBook(book: ParsedBook, opts?: {
maxChars?: number }): ParsedBook`. It walks the parser's blocks in order and merges
consecutive blocks into one chunk while all hold: same `path` (section), neither is a
`table` or `statBlock`, and the merged span stays within `maxChars` (default
`CHUNK_MAX_CHARS = 2000`, roughly 500 tokens). A merged chunk's span is
`[first.anchor.start, last.anchor.end)` and its text is `book.text.slice(start, end)`, so
span integrity holds by construction (blocks are contiguous, separated by `\n\n`). Kind:
a single-block chunk keeps its kind; a merged chunk is `prose`. A single block over the
budget stays whole — the chunker never splits inside a block.

The output is a `ParsedBook` whose `blocks` are the chunks, so `storeParsedBook` stores it
unchanged — **no `store.ts` edit** (TASK-0032 is moving its helper concurrently).

**Rationale**: satisfies "headings and tables intact" (a heading always leads the chunk its
section starts; tables and stat blocks are always whole) and "anchors recorded". Exported
and parameterized so TASK-0029's chunking-strategy axis can vary `maxChars` or pass
`maxChars: 0` for block-per-chunk. `ponytail:` character budget, not tokens; switch to a
tokenizer estimate when TASK-0029 shows it matters.

## R6 — Jobs table, claim, lease, and recovery

**Decision** (decision-0005): a `jobs` table. The worker loop claims one job:

```sql
UPDATE jobs SET status='running', attempts=attempts+1, claim_token=gen_random_uuid(),
       heartbeat_at=now(), started_at=coalesce(started_at, now()), stage='extract'
WHERE id = (
  SELECT id FROM jobs
  WHERE status='queued'
     OR (status='running' AND heartbeat_at < now() - interval '60 seconds')
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;
```

A claimed row whose `attempts` now exceeds `MAX_ATTEMPTS = 3` is immediately set `failed`
with reason "abandoned 3 times (process died mid-job)" and its upload file deleted.

- **Heartbeat**: every `HEARTBEAT_MS = 10 s` while running,
  `UPDATE jobs SET heartbeat_at=now() WHERE id=$1 AND claim_token=$2`.
- **Lease**: `LEASE = 60 s`. A process that dies stops heartbeating; after 60 s any worker's
  claim query picks the job up again. This is the "app restart mid-ingest" answer for
  TASK-0030: on restart the job resumes within `LEASE + POLL_MS` of the crash.
- **Fencing**: every state write (`stage`, terminal status, heartbeat) carries
  `AND claim_token=$2`. Zero rows updated means the job was reclaimed; the stale worker
  aborts its `AbortController` (which cancels its `gateway.embed` calls) and stops.
- **Idempotency** (AC #4): a job always re-runs from the start. `storeParsedBook` already
  replaces a same-named book atomically (lock, delete with cascade, insert). Embeddings
  hang off the new chunk ids, so a re-run never duplicates.
- **Polling**: `POLL_MS = 2 s` when idle; immediately after finishing a job; and on
  `nudge()`, which the upload route calls after enqueueing.
- **Concurrency**: one job at a time per process. Multiple processes (TASK-0030) are safe by
  `SKIP LOCKED` and fencing.

**Alternatives rejected**: resetting all `running` jobs at startup (unsafe with two
processes); advisory locks held for the job's lifetime (a pooled connection pinned for
minutes); `LISTEN/NOTIFY` wake-ups (polling at 2 s is enough; add when TASK-0030 measures
latency). `ponytail:` no graceful SIGTERM drain; the lease covers it.

## R7 — One active job per book

**Decision**: a partial unique index
`jobs_active_book_key ON jobs (lower(trim(book))) WHERE status IN ('queued','running')`.
The enqueue insert maps the unique violation (`23505`) to `ConflictError`. A database
constraint, not an application check (it holds across processes).

## R8 — Temp-file lifecycle

**Decision**: upload files live in `path.join(os.tmpdir(), "the-stacks-uploads")` as
`<uuid>.upload` (created `recursive: true` at startup). Order: stream to file → insert job →
respond `202`. Any failure before the insert commits (ceiling, client abort, validation,
conflict) deletes the file in a `finally`. The worker deletes the file when a job reaches
`succeeded` or `failed`. At worker start, delete files in the directory that no
queued/running job references and whose `mtime` is older than 10 minutes (an in-flight
upload keeps its mtime fresh). `ponytail:` directory not configurable; add `UPLOAD_DIR` when
a self-hoster's tmp is too small.

In the container, `os.tmpdir()` is `/tmp` in the container's writable layer: it survives
`restart`, not `recreate`. A job whose file is gone fails with "upload file missing".

## R9 — Upload ceiling configuration

**Decision**: `UPLOAD_MAX_BYTES` in `loadConfig` (`config.ts`, which stays free of relative
imports), default `1073741824` (1 GiB), must be a positive integer. Documented in
`.env.example` and the `configuration` wiki note. Over the ceiling: HTTP 413 via a new error
kind `too_large` (`PayloadTooLargeError`) added to the closed `ErrorKind` union in
`errors.ts`.

**Alternative rejected**: `validation` (400) for an oversize body: a client cannot tell
"fix the input" from "too big for this server", and 413 is the standard answer.

## R10 — Embedding (TASK-0026 obligation)

**Decision**: after storing, if the embed purpose is configured, embed every chunk's text via
`gateway.embed({ purpose, texts, signal })` in batches of 256 chunks and call
`attachEmbeddings` per batch with `model: vector.model` and `dim: vector.dim` **as the
gateway returned them**. The purpose name is `RETRIEVAL_EMBED_PURPOSE` (default
`"embedding"`), the same variable TASK-0026's `loadRetrievalConfig` reads. If
`specs/015`'s `retrieve.ts` is on `origin/main` when implementation starts, import
`loadRetrievalConfig` and use `.embedPurpose`; otherwise read the variable in one place in
`ingest/` with the same default and a `ponytail:` pointing at the swap the reconcile merge
makes.

"Configured" means `aiConfig.purposes[purpose]?.op === "embed"`. Unconfigured: the job
succeeds with `result.embedding = { status: "skipped", reason }`. A gateway error fails the
job at stage `embed`; chunks stay stored and keyword search works.

**Rationale**: retrieval filters stored vectors by the model the gateway reports; any other
purpose or model string makes vector search find nothing.

## R11 — Operator auth on the routes

**Decision**: reuse `createAuthMiddleware(validateSession)` on a `/library` sub-app. No
identity → `UnauthorizedError`; `role !== "operator"` → `ForbiddenError`, the same pattern as
`POST /auth/invitations`. SameSite=Lax on the session cookie blocks cross-site POSTs.
