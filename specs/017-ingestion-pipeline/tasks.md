# Tasks: Ingestion pipeline

**Input**: Design documents from `/specs/017-ingestion-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-ingest.md,
contracts/ingest-modules.md, quickstart.md

**Tests**: required. The spec's success criteria are test outcomes. DB suites MUST run
(0 skipped) with `REQUIRE_DATABASE=1` against this worktree's stack.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0024 && git branch --show-current` first. Expect `task-0024-ingestion-pipeline`. On any other branch, STOP.
- Never commit real book text. Fixtures are synthetic, original, or SRD 5.1. Zip fixtures are
  built inside the test from those files with the test's own stdlib zip writer helper.
- Never read `/Volumes/evan/dnd-sourcebooks` except in T034.
- Do not edit `apps/server/src/library/store.ts` (TASK-0032 owns its concurrent change).
- Add no runtime dependency. The operator checkpoint in plan.md must be cleared first.
- Commit per task group with a `TASK-0024:` subject and the Co-Authored-By trailer. Push.
  Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US5)

## Phase 1: Foundational — config, error kind, jobs table, job store

**Purpose**: the ceiling, the 413 kind, the `jobs` table, and the claim/lease functions that
every story depends on.

- [ ] T001 [P] In `apps/server/src/config.ts`, add `uploadMaxBytes: number` to `ServerConfig`. Read `UPLOAD_MAX_BYTES`, default `1073741824`, and throw `UPLOAD_MAX_BYTES must be a positive integer, got "<raw>"` on bad input. Keep the file free of relative imports. Add unit coverage in `apps/server/test/config.test.ts` (create it if absent): default, override, and rejection of `0`, `-1`, and `abc`.
- [ ] T002 [P] In `apps/server/src/errors.ts`, add `"too_large"` to `ErrorKind`, `too_large: 413` to `STATUS_BY_KIND`, a `PayloadTooLargeError` class, and its branch in `errorHandler`. Add a 413 shape case to `apps/server/test/echo.test.ts`, which already exercises `errorHandler`, or to a new `apps/server/test/errors.test.ts`.
- [ ] T003 [P] In `.env.example`, add a "Library ingestion" block. Document `UPLOAD_MAX_BYTES`: default 1 GiB, bytes, the reason for a high default (real exports are 40–310 MB), and the 413 answer. Add a commented `RETRIEVAL_EMBED_PURPOSE=embedding` line noting that ingestion embeds under the same purpose retrieval uses (TASK-0026 contract).
- [ ] T004 Create `apps/server/src/schema/jobs.ts` per data-model.md: columns, CHECKs on `kind`/`status`/`stage`, `jobs_claim_idx (status, created_at)`, and the partial unique index `jobs_active_book_key ON (lower(trim(book))) WHERE status IN ('queued','running')`. Header comment: operational state of the library plane, updatable by design, not under `library_immutable`.
- [ ] T005 Run `pnpm env:up`. Then run `pnpm --filter @the-stacks/server db:generate` to produce `apps/server/drizzle/0003_*.sql`. Review the SQL. Hand-fix only what drizzle-kit emits wrongly, with a SQL comment per edit. Apply it with `pnpm --filter @the-stacks/server db:migrate`. If TASK-0026/0029/0030 merged a migration first, merge `origin/main` in and regenerate. Never hand-merge `meta/_journal.json`.
- [ ] T006 Create `apps/server/src/library/ingest/jobs.ts` per contracts/ingest-modules.md: `JobStatusSchema` (Zod, contracts/http-ingest.md shape), `enqueueIngest` (unique violation → `ConflictError`), `listJobs`, `getJob`, `claimJob` (research R6 SQL: `FOR UPDATE SKIP LOCKED`, lease 60 s, `attempts+1`, new `claim_token`, attempts > 3 ⇒ `failed` "abandoned 3 times (process died mid-job)"), `heartbeat`, `setStage`, `finishJob`. Every post-claim write filters on `claim_token` and returns `false` when fenced out. Export constants `LEASE_MS`, `HEARTBEAT_MS`, `POLL_MS`, `MAX_ATTEMPTS`. For the unique-violation check, import the helper from `db.ts` if TASK-0032 has merged; otherwise use a local copy marked `ponytail:` for the merge.
- [ ] T007 Create `apps/server/test/library/jobs.integration.test.ts` (loud-skip harness copied from `store.integration.test.ts`). Cover: enqueue returns `queued`; a second active enqueue for " basic RULES " conflicts; two concurrent `claimJob` calls never return the same job; a `running` job with a fresh heartbeat is not reclaimed; one with `heartbeat_at` older than the lease is reclaimed with `attempts` 2 and a new token; the stale token's `setStage`/`finishJob`/`heartbeat` return `false` and change nothing; the fourth claim yields `failed`; `JobStatusSchema` never exposes `uploadPath` or `claim_token`.
- [ ] T008 Run `pnpm ci:check` and the DB suites with `REQUIRE_DATABASE=1` (TEST_DATABASE_URL from `.env`). Both must be green, with 0 DB suites skipped.

**Checkpoint**: `jobs` exists; claim/lease/fencing proven against real Postgres.

## Phase 2: User Story 2 — stream uploads to disk under a 1 GiB ceiling (Priority: P1)

**Goal**: `POST /library/uploads` streams the raw body to a temp file and enqueues a job
(AC #1, #7). **Independent test**: a > 300 MB synthetic body uploads with flat memory; over
the ceiling returns 413; aborts and refusals leave no file and no job.

- [ ] T009 [US2] Create `apps/server/src/routes/library.ts` exporting `createLibraryRoutes({ db, validateSession, uploadMaxBytes, uploadDir, onEnqueued })`. Use `createAuthMiddleware`: no identity → `UnauthorizedError`; non-operator → `ForbiddenError`. `POST /uploads` per contracts/http-ingest.md. Zod-validate `book` and `filename`. Refuse with `PayloadTooLargeError` when `Content-Length` exceeds the ceiling, before reading. Stream `c.req.raw.body` through `Readable.fromWeb` → a byte-counting `Transform` (throws `PayloadTooLargeError` past the ceiling) → `fs.createWriteStream(<uploadDir>/<uuid>.upload)` with `stream/promises.pipeline`. Detect format from the first 4 bytes and `filename` (research R4). An empty body → `ValidationError`. Call `enqueueIngest`, then `onEnqueued()`, and return `202 { job }`. In a `finally`, delete the file on every non-202 path, including a client abort. Never call `parseBody`, `arrayBuffer`, `text`, or `formData`.
- [ ] T010 [US2] In `apps/server/src/app.ts`, add `library?: { uploadMaxBytes; uploadDir; onEnqueued }` to `CreateAppOptions`, with test-safe defaults: 1 GiB, a tmp dir, and a no-op. Mount `app.route("/library", createLibraryRoutes(...))` before the static middleware, reusing the one `createValidateSession(db)`.
- [ ] T011 [US2] In `apps/server/src/index.ts`, pass `serverOptions: { requestTimeout: 60 * 60 * 1000 }` to `serve()`, with a `ponytail:` comment (research R1). Create `uploadDir = path.join(os.tmpdir(), "the-stacks-uploads")` (`mkdir recursive`). Pass `config.uploadMaxBytes` and `uploadDir` into `createApp`. Leave `onEnqueued` a no-op until T021.
- [ ] T012 [US2] Create `apps/server/test/library/uploads.integration.test.ts` (loud-skip harness; operator and player sessions created as `auth.integration.test.ts` does). Cover: 401 without a session; 403 for a player; 400 for a missing `book` and for an empty body; 202 with a queued `JobStatus` whose `bytes` equals the body length and whose `format` is detected; 409 on a second upload of the same book; 413 from `Content-Length` with a small `uploadMaxBytes` and no file left; 413 mid-stream (a body stream longer than the ceiling, no `Content-Length`) with no file and no job; a client abort mid-stream leaves no file and no job; after every refusal the upload dir holds no stray file.
- [ ] T013 [US2] In the same suite, add a streaming-memory case. Run the real `serve()` on an ephemeral port with `uploadMaxBytes` at 1 GiB. POST a generated 320 MB body as a stream (never materialized). Sample `process.memoryUsage().rss` during the upload and assert the peak rises by less than 64 MB over the baseline, and that the file size equals 320 MB. Mark the case with a tier comment (heavy) and keep its timeout generous.
- [ ] T014 [US2] Run `pnpm ci:check` and the DB suites (`REQUIRE_DATABASE=1`).

**Checkpoint**: large uploads land on disk and queue a job; nothing leaks on refusal.

## Phase 3: User Story 3 — structure-preserving chunker (Priority: P1)

**Goal**: pure `chunkBook` (AC #3). **Independent test**: unit invariants 1–7 in
contracts/ingest-modules.md. Parallel with Phase 2: no shared files.

- [ ] T015 [P] [US3] Create `apps/server/src/library/ingest/chunk.ts`: `CHUNK_MAX_CHARS = 2000` and `chunkBook(book, { maxChars })` per research R5. Merge consecutive blocks with equal `path`; never merge a `table` or `statBlock`; keep a merged span within `maxChars`; span = `[first.start, last.end)`; text = `book.text.slice(span)`; single-block kind kept, merged → `prose`; `maxChars: 0` ⇒ identity. Add a `ponytail:` comment: character budget, not tokens; TASK-0029 may revisit.
- [ ] T016 [P] [US3] Create `apps/server/test/library/chunk.test.ts`. Assert invariants 1–7 over the three committed DDB fixtures (`parseDdbExport` output) and hand-built books: a heading plus short paragraphs merge; a 5,000-char table stays one chunk; two sections never merge; an oversize single prose block stays whole; astral-plane text keeps span equality.

**Checkpoint**: the chunker is proven in isolation and ready for TASK-0029.

## Phase 4: User Story 1 — ingest D&D Beyond exports as delivered (Priority: P1) 🎯 MVP

**Goal**: zip / zip-of-zips / single page → parsed, chunked, stored, embedded by the worker
(AC #2, #4, #6). **Depends on**: Phases 1–3.

- [ ] T017 [P] [US1] Create `apps/server/src/library/ingest/zip.ts` per contracts/ingest-modules.md and research R2. Use `fileSource`/`bufferSource`, EOCD search in the last 64 KiB + 22 bytes, a central-directory walk, and local-header data offsets. Use `zlib.inflateRaw` (promisified) with `maxOutputLength: entry.size`, then check the declared size and `zlib.crc32`. Throw `ZipError` naming the problem for zip64, encryption, an unsupported method, a CRC mismatch, a size mismatch, or a missing EOCD. Header comment: the supported subset, and `yauzl` as the upgrade path.
- [ ] T018 [P] [US1] Create `apps/server/test/library/zip.test.ts` and a test-only helper `apps/server/test/library/zip-writer.ts`: a stdlib zip writer supporting stored and deflate. Cover: round-trip of stored and deflated entries; a nested zip read via `bufferSource`; a corrupt CRC → `ZipError`; an encrypted flag → `ZipError`; a method 12 → `ZipError`; a zip-bomb-shaped entry (declared size smaller than its inflation) → `ZipError`; a large outer zip read via `fileSource` without loading it whole.
- [ ] T019 [US1] Create `apps/server/src/library/ingest/collect.ts`: `collectPages(filePath, format, filename)` per research R3. For a zip, recurse ≤ 3 levels, deeper → `ValidationError`. Ignore `__MACOSX` segments, `.DS_Store`, `._*`, `*_files` segments, and directories. Skip non-page entries without inflating them. Accept `.html`/`.htm` pages, and `.md`/`.markdown` only for a top-level Markdown upload. Order with `Intl.Collator(undefined, { numeric: true })` over the nested path. De-duplicate by sha-256. Return the counts. A single HTML or Markdown upload reads the file as UTF-8. Zero pages → `ValidationError` "No HTML or Markdown pages found in the upload."
- [ ] T020 [US1] Create `apps/server/test/library/collect.test.ts` with synthetic zips built by the helper, mirroring the observed layouts in research.md: (a) MM shape — chapter folders, `__MACOSX/` twins, `.DS_Store`, `*_files/` with extensionless assets; (b) DMG/XGtE shape — a zip of per-chapter zips, stored method; (c) LMoP directory shape — per-chapter zips plus a combined zip of the same chapters, and an inner zip holding only a directory; (d) PHB order — "02 - …" before "10 - …". Assert page count, order, de-dup count, ignored and skipped counts, and that asset entries are never inflated (spy or count).
- [ ] T021 [US1] Create `apps/server/src/library/ingest/worker.ts` per contracts/ingest-modules.md. `runJob` runs stages `extract` (collectPages), `parse` (`parseDdbExport` when any page holds `CONTENT_ROOT`), `store` (`chunkBook` → `storeParsedBook(db, chunked, { source: { files, bytes } })`), and `embed` (research R10: `gateway.embed({ purpose: embedPurpose, texts, signal })` in batches of 256; `attachEmbeddings` with each returned `model`/`dim` unchanged; `skipped` with a reason when `embedPurpose` is null). Call `setStage` before each stage and abort when fenced out. `startIngestWorker` polls every `POLL_MS`, runs one job at a time, heartbeats every `HEARTBEAT_MS` during `runJob`, and aborts the `AbortController` on a failed heartbeat. It calls `finishJob` with `JobResult` or a text-free error message: a `ValidationError`/`ZipError` message; any other error → "Ingestion failed at stage <stage>." logged with `console.error`. It deletes the upload file on terminal states. On start, it sweeps orphaned upload files older than 10 minutes that no active job references (research R8). A missing upload file fails the job with "upload file missing". It exposes `nudge()` and `stop()`. The worker loop must never throw out of its loop.
- [ ] T022 [US1] Wire the worker in `apps/server/src/index.ts`. Resolve `embedPurpose` as follows. If `loadRetrievalConfig` exists on this branch (TASK-0026 merged), use its `embedPurpose`. Otherwise read `process.env.RETRIEVAL_EMBED_PURPOSE ?? "embedding"` in one place with a `ponytail:` naming the swap. In both cases, set it to `null` unless `aiConfig.purposes[name]?.op === "embed"`. Remove the `biome-ignore` on `aiGateway` now that it has a caller. Start the worker with `{ db, gateway: aiGateway, embedPurpose, uploadDir }` and pass `worker.nudge` as `onEnqueued`.
- [ ] T023 [US1] Create `apps/server/test/library/worker.integration.test.ts` (loud-skip harness; `createGateway` with a `fake` provider and an `embedding` purpose). Cover: a synthetic MM-shaped zip → `succeeded`, `parser: "ddb"`, chunk count equal to `chunkBook(parseDdbExport(...)).blocks.length`, every stored chunk's span equal to its text, and one embedding per chunk whose `model` equals the gateway-reported model (TASK-0026 obligation); a zip-of-zips; a single HTML page; re-upload of the same book → `replaced: true` with identical chunk and embedding counts and no duplicates (AC #4); `embedPurpose: null` → `succeeded` with `embedding.status: "skipped"`; a gateway error → `failed` at stage `embed` with chunks still stored; an empty zip → `failed` "No HTML or Markdown pages…"; the upload file is deleted after both terminal states; no job `error` contains fixture text.
- [ ] T024 [US1] Run `pnpm ci:check` and the DB suites (`REQUIRE_DATABASE=1`).

**Checkpoint**: MVP. A D&D Beyond export in any delivered shape becomes a stored, embedded book.

## Phase 5: User Stories 4 and 5 — generic HTML, Markdown, job status, crash recovery (Priority: P2)

**Goal**: best-effort non-DDB formats (AC #1) and operator-visible status plus recovery
(AC #5, #4). The US4 and US5 tasks touch different files and may run in parallel.

- [ ] T025 [P] [US4] In `apps/server/src/library/ddb/index.ts` and `walk.ts`, add `options?: { headings?: "ddb" | "all" }` to `parseDdbExport`, threaded to `walkPages`. With `"all"`, every `h1`–`h6` is a section heading; the default `"ddb"` is byte-for-byte today's behaviour. Add generic-HTML cases to `apps/server/test/library/ddb.test.ts` (an unclassed `h2`/`h3` page gives paths from its headings). Every existing DDB test passes unchanged.
- [ ] T026 [P] [US4] Create `apps/server/src/library/ingest/markdown.ts`: `parseMarkdown({ book, text })` → `ParsedBook` per research R4. ATX headings push the path stack. A fenced block is one `prose` block. Consecutive `|` lines are one `table` block. Consecutive list lines are one `list` block. Blank-line paragraphs are `prose`. Text is joined by `\n\n` with UTF-16 anchors. Zero blocks → `ValidationError`. Add a `ponytail:` naming the unsupported syntax. Create `apps/server/test/library/markdown.test.ts`: span equality for every block, heading paths, table and fence whole, CRLF input.
- [ ] T027 [US4] In `worker.ts`, route the parse stage. DDB markup → `parseDdbExport`. Other HTML → `parseDdbExport(..., { headings: "all" })` with `parser: "html"`. Markdown → `parseMarkdown` with `parser: "markdown"`. Add worker integration cases for a plain HTML page and a Markdown file.
- [ ] T028 [P] [US5] In `apps/server/src/routes/library.ts`, add `GET /jobs?limit` (1..100, default 20, newest first) and `GET /jobs/:id` (a malformed or unknown id → `NotFoundError`), both operator-only, serialized through `JobStatusSchema`. Extend `uploads.integration.test.ts`: list order; get by id; 404; 401/403; while a job runs, `stage` is non-null; after it ends, `result` or `error` is set per the contract.
- [ ] T029 [US5] Add a recovery case to `worker.integration.test.ts`. Enqueue a job, claim it with a separate `claimJob` call (simulating a process that died), and age its `heartbeat_at` past the lease with SQL. Start a worker. Assert `succeeded`, `attempts` 2, chunk and embedding counts equal to a clean run. Then assert the stale claim's `finishJob` returns `false` and leaves the row unchanged. Add a case where `attempts` is already 3: the next claim marks it `failed` "abandoned 3 times…" and deletes its upload file.
- [ ] T030 [US5] Run `pnpm ci:check` and the DB suites (`REQUIRE_DATABASE=1`).

**Checkpoint**: all seven ACs have passing tests.

## Phase 6: Polish, merge condition, re-grounding, and gates

**Purpose**: the runbook's per-PR gates and the TASK-0024 merge condition.

- [ ] T031 Merge `origin/main` into the branch (never rebase). If TASK-0032 merged, switch `jobs.ts` to the `db.ts` helper and drop the local copy. If TASK-0026 merged, switch the embed purpose to `loadRetrievalConfig().embedPurpose` and drop the `ponytail:`. If another migration landed, regenerate `0003` per T005. Re-run T032.
- [ ] T032 Run `pnpm ci:check` in the worktree. It must be green. If this PR adds a host-run script, or a module a host script imports, extend `check:host-scripts` in root `package.json` in this PR. None is planned: `config.ts` keeps zero relative imports; state that in the PR body.
- [ ] T033 Run every DB suite with `REQUIRE_DATABASE=1` on this worktree's stack (`pnpm env:up`; `TEST_DATABASE_URL` from `.env`). Record the counts (passed, 0 skipped) for the PR body.
- [ ] T034 Merge condition (runbook "Task-specific merge conditions", TASK-0024), per quickstart.md §2–3. Rebuild the stack (`pnpm env:up`) and sign in as the operator. Configure the `fake` embedding provider unless the operator has approved a paid run. Upload each real export in its delivered form, one at a time: PHB and LMoP as a zip of their per-chapter zips (scratch zip outside the repo); DMG, MM, and XGtE as their single zips; one single HTML page; one Markdown file. Record in the PR body, per book: HTTP result, job status, chunk count, and embedding status. Record the app's peak RSS during the MM upload (baseline, peak, delta; pass < 64 MB). Record `UPLOAD_MAX_BYTES` = 1 GiB and where it is documented. If XGtE fails without crashing the worker, record it and card it with the `backlog` CLI inside the worktree; it does not block. Delete the scratch files. Copy no book text anywhere.
- [ ] T035 Restart spot check (quickstart §4). Restart the app during the MM job's `store` stage. Record `attempts` 2, final `succeeded`, and a chunk count equal to T034's.
- [ ] T036 Wiki review with honest re-pins (`/grounding-wiki:wiki-update`). Classify each pinned note as RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>`, and amend prose before bumping any NEEDS-REVIEW pin. Expected: `library-schema`, `ddb-parser` (the `headings` option), `configuration` (`UPLOAD_MAX_BYTES`), `server-entrypoint-and-app` (`/library` mount, worker start, `requestTimeout`, `aiGateway` now used), `database-schema` (`jobs`), `migrations` (`0003`), `overview`, `error-contract` (`too_large`), and `ai-gateway` (first caller). Write a new note, `docs/wiki/ingestion.md` (kind: pipeline), covering upload transport, zip reader, filtering, parse routing, chunker, jobs/lease/fencing/recovery, embedding obligation, and temp files, with its sources and pin. Add it to `INDEX.md` under Library. Regenerate `CAPSULES.md`, because descriptions change.
- [ ] T037 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. It must print `OK`. Never run `gates/freshness.mjs`.
- [ ] T038 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. It must exit 0. Tick this file's completed tasks.
- [ ] T039 Run `pnpm env:down`, then `pnpm env:prune --check`. The prune check must exit 0.

## Dependencies & Execution Order

- Phase 1 blocks everything.
- Phase 2 (US2) and Phase 3 (US3) are independent after Phase 1 and may run in parallel.
- Phase 4 (US1) needs Phases 1–3: the route, the chunker, and the job store.
- Phase 5: US4 needs Phase 4's worker (T027). US5's T028 needs only Phase 2; T029 needs Phase 4.
- Phase 6 needs all of the above.
- Dispatch: one implementer per phase, re-grounded from this spec dir and the branch commits.
  Phases 2 and 3 are the only safe concurrent pair.

## Parallel Examples

- Phase 1: T001, T002, and T003 together; then T004 → T005 → T006 → T007.
- Phase 3: T015 and T016 together (write the invariants test against the contract first).
- Phase 4: T017 and T018 together, then T019 → T020, then T021 → T022 → T023.
- Phase 5: T025, T026, and T028 together.

## Implementation Strategy

MVP = Phases 1–4: a real D&D Beyond export in any delivered shape uploads without a size
wall and becomes a stored, chunked, embedded book. Phase 5 adds the P2 formats and the
status routes that TASK-0028 reads. Phase 6 proves it on the operator's real books and
re-grounds the wiki. The PR is not merge-ready until T034's record is in its body.
