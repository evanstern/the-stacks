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

## Reversal — operator ruling 2026-09-29

The first draft of this file chose a stdlib zip reader (R2) and a raw-body upload with query
parameters (R1), both to add no runtime dependency. The operator reviewed the plan
checkpoint and ruled the other way on both (card TASK-0024, implementation notes, "Operator
rulings 2026-09-29"):

1. Zip reading uses `yauzl@3`, an approved runtime dependency.
2. Upload transport is `multipart/form-data` parsed with `busboy`, an approved runtime
   dependency.
3. `requestTimeout` 300 s → 1 h: approved as planned.
4. The merge-condition real-export run embeds with the `fake` provider: approved as planned.

Why the reversal holds up: a hand-written zip reader is ~150 lines of format parsing that
this project would own, test, and extend (zip64, data descriptors) the first time an export
leaves the observed subset; `yauzl` already handles those and is the reference Node reader.
Multipart is what a browser `FormData` upload and `curl -F` send by default, so the UI
(TASK-0028) and agents use the standard shape instead of a bespoke query-string contract.
Both packages are small, pure JS, and stream-oriented, so AC #7 (never buffer the body,
never load the outer zip whole) still holds. R1 and R2 below record the ruled design; the
superseded choices are kept under "Superseded".

## R1 — Upload transport: multipart via `busboy`, streamed to disk

**Decision**: `POST /library/uploads` with `Content-Type: multipart/form-data`. Parts:

- `book` — text field, required.
- `file` — exactly one file part. Its `filename` (from `Content-Disposition`) is the display
  name and a format hint; default `upload` when absent.

The handler never calls `parseBody`, `formData`, `arrayBuffer`, or `text`. It converts
`c.req.raw.body` with `Readable.fromWeb` and pipes it into
`busboy({ headers, limits: { files: 1, fields: 4, fieldSize: 1024, parts: 5, fileSize: uploadMaxBytes } })`.
On the `file` event it pipes the part stream through a byte-counting `Transform` (it records
the total and the first 4 bytes for format detection) into
`fs.createWriteStream(<uploadDir>/<uuid>.upload)`. The response waits for both busboy
`close` and the write stream's `finish`, then validates fields, inserts the job, and
returns `202`.

**Edge-case decisions**:

| Case | Decision |
|---|---|
| Not `multipart/form-data`, or no boundary | `busboy()` throws → `400 validation` "Expected multipart/form-data." No body read. |
| `Content-Length` over `uploadMaxBytes + 1 MiB` | `413 too_large` before reading a byte. The 1 MiB allowance covers multipart framing and fields. No `Content-Length` (chunked) is allowed; the stream limit still applies. |
| Fields after the file part | Accepted. Fields are collected into a map and validated only after busboy `close`, when the file is already on disk. A bad or missing `book` then deletes the file → `400`. Clients SHOULD append `book` first; the server does not depend on it. |
| No file part | `400 validation` on `file`: "A file part is required." No temp file was created. |
| Empty file part (0 bytes) | `400 validation` "Upload body is empty."; file deleted. |
| File part under another name than `file` | `400 validation` on `file`; the part is drained (`resume()`), never written. |
| Two or more file parts | `limits.files: 1`; busboy emits `filesLimit` when the second arrives → `400 validation` "Exactly one file part is allowed."; the first file is deleted. |
| Too many fields / parts; a field value over 1 KiB | `fieldsLimit` / `partsLimit` / `valueTruncated` → `400 validation`. |
| Size ceiling | **busboy is the one authority**: `limits.fileSize = uploadMaxBytes`. busboy's `limit` event on the file stream → `413 too_large`. As a backstop, `stream.truncated === true` at the end is also `413`. The byte counter records `bytes` only and holds no second ceiling, so the two can never disagree. |
| Client abort mid-upload | The source stream errors or ends early; busboy errors "Unexpected end of form"; the pipeline rejects → file deleted, no job. |
| Early refusal (413, 400) while the client is still sending | Unpipe busboy, destroy the file stream and the source stream, delete the file, and respond with `Connection: close` so the unsent remainder is dropped rather than drained. |
| Any error before the job insert commits | One `finally` deletes the temp file if it exists. After the insert, the worker owns the file. |

**Rationale**: `@hono/node-server` 2.1.x exposes the incoming request as
`Readable.toWeb(incoming)` (pull-based, backpressured; verified in its `dist/index.mjs`), so
nothing is buffered unless a handler calls `parseBody` or similar. busboy is a streaming
parser: its memory is bounded by its field limits and the stream's high-water mark,
regardless of the file size. Browsers send `FormData` bodies as streamed multipart, and
`curl -F file=@book.zip` does the same.

**Node server timeout**: Node's `http.Server.requestTimeout` defaults to 300 s, which would
cut a 310 MB upload on a slow link. Pass `serverOptions: { requestTimeout: 60 * 60 * 1000 }`
to `serve()` in `index.ts` (approved 2026-09-29). `ponytail:` fixed one-hour ceiling; make
it config when a self-hoster reports a slower link.

**Superseded** (first draft): raw request body with `book`/`filename` as query parameters.
Declined by the operator ruling 2026-09-29 in favour of the standard multipart shape.

**Still rejected**: Hono `parseBody` / `c.req.formData()` (buffers the whole body);
hand-rolled multipart parsing (boundary scanning across chunk edges).

## R2 — Zip reading: `yauzl`, inner zips via temp files

**Decision**: `apps/server/src/library/ingest/zip.ts` wraps `yauzl@^3.4.0`. It opens a zip
**file** with `yauzl.open(path, { lazyEntries: true, autoClose: false, decodeStrings: true,
validateEntrySizes: true, strictFileNames: false })`. `yauzl` reads the central directory
and entry data by offset from the file descriptor, so the outer zip is never loaded whole.
Entries are visited one at a time (`readEntry()` after each visit completes), and the
handle is closed in a `finally`.

For each visited entry the caller either:

- **reads a page** into memory (`openReadStream` → collect, ≤ `MAX_PAGE_BYTES`), then
  checks `zlib.crc32(buffer) === entry.crc32`; or
- **extracts an inner zip** to `<jobDir>/<counter>.zip` (`openReadStream` → CRC `Transform`
  using `zlib.crc32(chunk, running)` → `createWriteStream`), then opens that file with
  `yauzl.open` and recurses. The file is deleted after its subtree is walked. Temp names are
  counters, never entry names, so no entry name reaches the filesystem; `yauzl` also rejects
  absolute and `..` names; or
- **skips** the entry without opening a read stream (nothing is inflated).

**Guards** (each throws `ZipError` naming the problem; the job fails with that message):

- `yauzl` open errors: missing or malformed End of Central Directory, invalid file names.
- Encrypted entry (`entry.isEncrypted()`), or a compression method other than 0/8 — checked
  before opening a stream.
- Inflated size ≠ declared size (`validateEntrySizes`; zip-bomb guard 1).
- A page entry declared over `MAX_PAGE_BYTES` = 16 MiB (observed pages ≤ ~1 MB).
- The job's total declared bytes inflated (pages + extracted inner zips) over
  `EXTRACT_BUDGET_BYTES` = 2 GiB (zip-bomb guard 2). `ponytail:` fixed constants; make them
  config when a real export exceeds them.
- CRC mismatch (`yauzl` does not verify CRC-32; the wrapper does, with `zlib.crc32`, Node ≥ 22.2).
- Nesting deeper than 3 levels.

zip64 is now **supported** (yauzl reads the zip64 extra field); the spec's edge case is
narrowed to encryption and unsupported methods.

**Rationale**: `yauzl` is the correctness-first Node zip reader: random access via the
central directory, zip64, strict entry-size validation, safe file-name checks. Extracting
inner zips to disk keeps memory flat regardless of inner-zip size (DMG's chapter zips are
up to ~12 MB; nothing bounds a future export's). `yauzl.fromBuffer` would work for small
inner zips, but one code path over files is simpler and has no size ceiling.

**Superseded** (first draft): a ~150-line stdlib reader on `node:zlib` covering only the
observed subset. Declined by the operator ruling 2026-09-29.

**Still rejected**: `fflate` / `adm-zip` / `jszip` (whole-archive-in-memory APIs, contradict
AC #7); shell `unzip` (different tools on host and alpine, output parsing).

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
`<uuid>.upload` (created `recursive: true` at startup). During a job, extracted inner zips live
in `<uploadDir>/job-<jobId>/`; the worker removes that directory (`rm -r`) when the job
reaches any terminal state, and on a fenced-out abort. A re-run (lease reclaim) removes a leftover
`job-<jobId>/` before `extract` starts. Order: stream to file → insert job →
respond `202`. Any failure before the insert commits (ceiling, client abort, validation,
conflict) deletes the file in a `finally`. The worker deletes the file when a job reaches
`succeeded` or `failed`. At worker start, delete files and `job-*` directories that no
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
