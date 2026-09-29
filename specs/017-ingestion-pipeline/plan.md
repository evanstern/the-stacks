# Implementation Plan: Ingestion pipeline

**Branch**: `task-0024-ingestion-pipeline` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0024 | **Input**: `specs/017-ingestion-pipeline/spec.md`

## Summary

The operator streams a book export to `POST /library/uploads` as `multipart/form-data`.
`busboy` parses the stream; the file part goes to a temp file under a 1 GiB default
ceiling, and a row lands in a new `jobs` table. An in-process worker claims jobs with
`FOR UPDATE SKIP LOCKED` under a heartbeat lease. It reads zips (nested ≤ 3 levels) with
`yauzl`, extracting inner zips to temp files, and collects HTML and Markdown pages. It parses them with the existing D&D Beyond parser (or its new
all-headings mode, or a small Markdown splitter). A pure chunker merges blocks within a
section and keeps tables and stat blocks whole. The unchanged `storeParsedBook` stores the
result, and the worker embeds it through the AI gateway under retrieval's purpose. Job
status is readable at `GET /library/jobs[/:id]`. **Two new runtime dependencies,
approved by the operator ruling 2026-09-29: `yauzl` and `busboy`.**

## Technical Context

**Language/Version**: TypeScript on Node 22 (≥ 22.2 for `zlib.crc32`; image `node:22-alpine`)

**Primary Dependencies**: existing — Hono, `@hono/node-server`, drizzle-orm, pg, parse5,
zod. New (operator ruling 2026-09-29) — `yauzl@^3.4.0` (zip reading) and `busboy@^1.6.0`
(multipart parsing). Stdlib: `node:zlib` (`crc32`), `node:fs/promises`,
`node:stream/promises`, `node:crypto`, `node:os`.

**Storage**: Postgres 17 + pgvector. New `jobs` table (migration `0003_*`). Existing
`library_*` tables unchanged.

**Testing**: vitest. Unit suites need no database. DB suites follow the
`REQUIRE_DATABASE=1` / `describe.skipIf(!reachable)` pattern.

**Target Platform**: the `app` container; host-run tests.

**Project Type**: web service (`apps/server`).

**Performance Goals**: a 310 MB upload streams at link speed with flat memory. MM
(30 pages, 13 MB HTML) ingests in minutes, not hours.

**Constraints**: body never buffered whole (AC #7); `parseBody` is never called. The
outer zip is never loaded whole: `yauzl.open` with `lazyEntries` reads it by offset. Only
page entries are inflated into memory (≤ ~1 MB each). Inner zips are streamed to temp files
and opened with `yauzl` the same way.

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
- [x] **IX. Self-hostable** — no new container or service. Two small pure-JS runtime
      dependencies (`yauzl`, `busboy`), approved by the operator ruling 2026-09-29. Works from
      `docker compose up`. Embeddings go through the AI gateway; unset AI config skips
      embedding and the job still succeeds.

**Stack conformance** — within the Architecture Constraints table. The worker loop runs in
the existing Node process, which the table names.

## Operator checkpoints

**All decided by the operator ruling 2026-09-29** (card TASK-0024 implementation notes).
Implementation dispatch is cleared.

1. **Zip reading: `yauzl` — decided.** The plan's stdlib reader was declined. Add
   `yauzl@^3.4.0` (deps: `pend`). It reads by offset with `lazyEntries`, so the outer zip
   is never loaded whole. It handles zip64 and validates entry sizes. Inner zips are
   extracted to temp files, then opened with `yauzl` (research R2).
2. **Upload transport: multipart via `busboy` — decided.** The plan's raw body plus query
   parameters was declined. Add `busboy@^1.6.0` (deps: `streamsearch`). `book` travels as a
   form field; the one file part streams to the temp file. `parseBody` is never called
   (research R1). Clients: SPA `FormData` + `fetch`; `curl -F`.
3. **`requestTimeout` 300 s → 1 h — approved as planned** (research R1). A new error kind,
   `too_large` (HTTP 413), joins the closed `ErrorKind` union (research R9).
4. **Merge-condition real-export run embeds with the `fake` provider — approved as
   planned.** A paid run is out of scope.

**Exact additions to `apps/server/package.json`** (one commit, T000):

| Section | Package | Range |
|---|---|---|
| `dependencies` | `busboy` | `^1.6.0` |
| `dependencies` | `yauzl` | `^3.4.0` |
| `devDependencies` | `@types/busboy` | `^1.5.4` |
| `devDependencies` | `@types/yauzl` | `^3.4.0` |

Neither runtime package ships its own types, so both `@types` packages are needed.

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
| Transport | multipart: `Readable.fromWeb(body)` → `busboy` (`limits.fileSize` = ceiling, `files: 1`) → file part → `createWriteStream` | R1 |
| Ceiling | `UPLOAD_MAX_BYTES`, default 1 GiB, in `loadConfig`; 413 `too_large`; documented in `.env.example` + wiki `configuration` | R9 |
| Temp files | `os.tmpdir()/the-stacks-uploads/<uuid>.upload`, plus a per-job `job-<uuid>/` dir for inner zips; deleted on refusal, abort, and terminal job; orphan sweep at worker start | R8 |
| Zip | `yauzl` (`lazyEntries`, `validateEntrySizes`); inner zips extracted to temp files; ≤ 3 nesting levels; page CRC via `zlib.crc32` | R2 |
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
