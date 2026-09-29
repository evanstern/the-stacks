# Implementation Plan: Ingestion pipeline

**Branch**: `task-0024-ingestion-pipeline` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0024 | **Input**: `specs/017-ingestion-pipeline/spec.md`

## Summary

The operator streams a book export to `POST /library/uploads` as a raw request body. The
body goes to a temp file under a 1 GiB default ceiling, and a row lands in a new `jobs`
table. An in-process worker claims jobs with `FOR UPDATE SKIP LOCKED` under a heartbeat
lease. It reads zips (nested ≤ 3 levels) with a small stdlib reader and collects HTML and
Markdown pages. It parses them with the existing D&D Beyond parser (or its new
all-headings mode, or a small Markdown splitter). A pure chunker merges blocks within a
section and keeps tables and stat blocks whole. The unchanged `storeParsedBook` stores the
result, and the worker embeds it through the AI gateway under retrieval's purpose. Job
status is readable at `GET /library/jobs[/:id]`. **No new runtime dependency.**

## Technical Context

**Language/Version**: TypeScript on Node 22 (≥ 22.2 for `zlib.crc32`; image `node:22-alpine`)

**Primary Dependencies**: existing only — Hono, `@hono/node-server`, drizzle-orm, pg,
parse5, zod. Stdlib: `node:zlib`, `node:fs/promises`, `node:stream/promises`,
`node:crypto`, `node:os`.

**Storage**: Postgres 17 + pgvector. New `jobs` table (migration `0003_*`). Existing
`library_*` tables unchanged.

**Testing**: vitest. Unit suites need no database. DB suites follow the
`REQUIRE_DATABASE=1` / `describe.skipIf(!reachable)` pattern.

**Target Platform**: the `app` container; host-run tests.

**Project Type**: web service (`apps/server`).

**Performance Goals**: a 310 MB upload streams at link speed with flat memory. MM
(30 pages, 13 MB HTML) ingests in minutes, not hours.

**Constraints**: body never buffered whole (AC #7). The outer zip is never loaded whole;
it is read by offset. Only HTML entries are inflated (≤ ~1 MB each). Inner zips (≤ 12 MB)
are held in memory one at a time.

**Scale/Scope**: single operator, one job at a time per process, books of 30–40 pages and
up to ~10k blocks.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents drive ingestion through the same HTTP routes
      (`POST /library/uploads`, `GET /library/jobs[/:id]`) with an operator session. The
      in-process modules (`collectPages`, `chunkBook`, `enqueueIngest`, `runJob`) are plain
      exported functions. No human-only path.
- [x] **II. Content contract** — N/A: no codex entity. `JobStatus` is a Zod schema.
- [x] **III. Data planes** — all new code sits in `apps/server/src/library/`; `jobs` is the
      library plane's operational table. Library content stays immutable (the replace path is
      the existing delete-and-insert). The worker imports only `ai/` (the gateway seam) and
      `library/`. No codex or session import; the Biome boundary rule already covers
      `library/**`.
- [x] **IV. Event sourcing** — N/A: no play state. Jobs are operational state, not events.
- [x] **V. Citations** — every chunk carries book, section path, and a UTF-16 span whose
      slice equals its text (chunker invariant 1; the store re-checks). Retrieval evals are
      TASK-0029's; the chunker is exported for its strategy axis.
- [x] **VI. System-agnostic** — ingestion is book-format logic. D&D Beyond is a parser, not a
      mechanic; no 5e rule enters the core.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — ships no book text: tests use synthetic, original,
      or SRD 5.1 fixtures, and zip fixtures are built in-test from them. Real exports are
      read in place from the operator's volume and never copied into the repo. Job
      records, errors, and logs carry counts and names, never page text. Uploaded books land
      only in the operator's database volume; temp files are deleted at job end.
- [x] **IX. Self-hostable** — no new container, service, or dependency. Works from
      `docker compose up`. Embeddings go through the AI gateway; unset AI config skips
      embedding and the job still succeeds.

**Stack conformance** — within the Architecture Constraints table. The worker loop runs in
the existing Node process, which the table names.

## Operator checkpoints

**Stop here for a yes before implementation dispatch.**

1. **New runtime dependencies: none proposed.**
   - Zip reading: a ~150-line stdlib reader (`node:zlib` `inflateRaw` + `crc32`) covering
     exactly what all five real exports use: stored/deflate, no zip64, no encryption, and
     fewer than 65,535 entries (research R2, observed with `unzip -Zv`).
     *Declined:* `yauzl` (+ `buffer-crc32`, `pend`). It is the upgrade path if a future
     export needs zip64 or another method, and the swap stays inside `zip.ts`. Shell
     `unzip` was also declined: it is a different tool on host and alpine, it needs output
     parsing, and it extracts to disk.
   - Markdown: a line-based splitter (research R4). *Declined:* `marked` / `micromark`.
   - Multipart: not needed; see transport.
   **Operator decision requested:** accept the stdlib zip reader (recommended), or approve
   `yauzl@3` as a runtime dependency instead.
2. **Upload transport: raw request body, streamed to disk** (research R1). The file is the
   request body; `book` and `filename` are query parameters. `@hono/node-server` exposes the
   body as a backpressured stream, which is piped through a byte counter to a temp file.
   `parseBody` is never called. No multipart parser means no dependency. Clients: SPA
   `fetch(url, { method: "POST", body: file })`; `curl --data-binary @file`.
   **Operator decision requested:** accept raw-body upload (recommended), or require
   multipart, which brings in `busboy` as a runtime dependency.
3. **Also note:** the Node server's `requestTimeout` rises from its 300 s default to one
   hour, so a large upload over a slow link is not cut off (research R1). A new error kind,
   `too_large` (HTTP 413), joins the closed `ErrorKind` union (research R9).

## Requirements carried from other tasks

- **TASK-0026 retrieval contract (binding)** — `specs/015-hybrid-retrieval/contracts/
  retrieval.md` (branch `task-0026-hybrid-retrieval`). Retrieval embeds the question via
  `gateway.embed` under the `AI_PURPOSES` entry named by `RETRIEVAL_EMBED_PURPOSE`
  (default `"embedding"`). It filters stored vectors by the model name the gateway returns.
  **Therefore the ingest embed step MUST call `gateway.embed` with the purpose named by
  `RETRIEVAL_EMBED_PURPOSE` (default `"embedding"`). It MUST store each returned
  `EmbedVector.model` and `dim`, unchanged, in `library_embeddings.model` and `.dim`.**
  Any other purpose or model string makes vector search find nothing. When 0026 has merged
  first, use its `loadRetrievalConfig().embedPurpose`. Otherwise read the variable in one
  place with the same default, and swap it at the reconcile merge (research R10).
- **TASK-0028 / TASK-0030** consume `contracts/http-ingest.md` (the `JobStatus` shape and
  recovery semantics).
- **TASK-0029** consumes `chunkBook` (`contracts/ingest-modules.md`) for its
  chunking-strategy axis.
- **TASK-0032** is moving the unique-violation helper out of `store.ts` into `db.ts`. This
  plan makes **no `store.ts` edit**: the chunker outputs a `ParsedBook`, which
  `storeParsedBook` accepts as-is. `jobs.ts` uses the helper from wherever `origin/main`
  has it when the phase starts: `db.ts` if 0032 has merged, otherwise a local copy marked
  `ponytail:` for the merge.

## Recovery of a job claimed by a dead process

Lease plus heartbeat plus fencing (research R6). A running job heartbeats every 10 s. Any
worker may reclaim a `running` job whose `heartbeat_at` is older than 60 s; the reclaim
increments `attempts` and issues a new `claim_token`. Every worker write filters on its
`claim_token`, so a stale worker that wakes up is fenced out and aborts. A re-run starts
from `extract` and replaces the book wholesale, so it is idempotent. The fourth claim marks
the job `failed`. After an app restart, the job resumes within about 62 s of its last
heartbeat. This behaviour is published for TASK-0030 in `contracts/http-ingest.md`.

## Design summary (details in research.md)

| Concern | Decision | Ref |
|---|---|---|
| Transport | raw body → `pipeline(Readable.fromWeb(body), counter, createWriteStream)` | R1 |
| Ceiling | `UPLOAD_MAX_BYTES`, default 1 GiB, in `loadConfig`; 413 `too_large`; documented in `.env.example` + wiki `configuration` | R9 |
| Temp files | `os.tmpdir()/the-stacks-uploads/<uuid>.upload`; deleted on refusal, abort, and terminal job; orphan sweep at worker start | R8 |
| Zip | stdlib reader, offset reads, ≤ 3 nesting levels, size + CRC checks | R2 |
| Filtering | ignore `__MACOSX`, `.DS_Store`, `._*`, `*_files/`, dirs; skip non-page entries uninflated; numeric-collated order; sha-256 de-dup | R3 |
| Parsing | DDB markup → `parseDdbExport`; other HTML → `parseDdbExport(…, { headings: "all" })`; Markdown → `parseMarkdown` | R4 |
| Chunking | pure `chunkBook`: merge within a section to 2000 chars; tables and stat blocks whole; spans contiguous | R5 |
| Jobs | `jobs` table; SKIP LOCKED claim; 60 s lease / 10 s heartbeat; `claim_token` fencing; max 3 attempts | R6 |
| One active job per book | partial unique index → 409 | R7 |
| Idempotency (AC #4) | re-run always starts over; `storeParsedBook` replaces atomically | R6 |
| Embedding | `RETRIEVAL_EMBED_PURPOSE` purpose; gateway-reported model stored; skipped with reason when unconfigured | R10 |
| Auth | operator-only via existing auth middleware | R11 |

## Project Structure

### Documentation (this feature)

```text
specs/017-ingestion-pipeline/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-ingest.md       # routes + JobStatus (consumed by 0028, 0030)
│   └── ingest-modules.md    # zip, collect, markdown, chunk, jobs, worker (0029, 0030)
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
apps/server/
├── src/
│   ├── config.ts                 # + uploadMaxBytes (UPLOAD_MAX_BYTES)
│   ├── errors.ts                 # + too_large / PayloadTooLargeError (413)
│   ├── app.ts                    # + /library route (before static), options: uploadMaxBytes, nudge
│   ├── index.ts                  # + requestTimeout, start worker, pass gateway
│   ├── schema/jobs.ts            # new
│   ├── routes/library.ts         # new: uploads + jobs routes
│   └── library/
│       ├── ddb/index.ts, walk.ts # + headings: "all" option
│       └── ingest/               # new
│           ├── zip.ts
│           ├── collect.ts
│           ├── markdown.ts
│           ├── chunk.ts
│           ├── jobs.ts
│           └── worker.ts
├── drizzle/0003_*.sql            # generated
└── test/
    ├── library/zip.test.ts, collect.test.ts, markdown.test.ts, chunk.test.ts, ddb.test.ts (+generic)
    ├── library/jobs.integration.test.ts, worker.integration.test.ts
    ├── library/uploads.integration.test.ts
    └── config.test.ts (or existing config coverage)
.env.example                      # + UPLOAD_MAX_BYTES, RETRIEVAL_EMBED_PURPOSE note
package.json                      # check:host-scripts += schema/jobs.ts only if a host script imports it
```

**Structure Decision**: everything inside `apps/server`. Ingestion modules live under
`library/ingest/` so the existing library boundary rule covers them. The route lives in
`routes/`, beside `auth.ts`. `config.ts` gains one field and keeps zero relative imports,
so `check:host-scripts` still passes. It needs extending only if a host-run script comes to
import a new module; none is planned.

## Complexity Tracking

No constitution violations. No entries.
