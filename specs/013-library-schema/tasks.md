# Tasks: Library schema

**Input**: Design documents from `/specs/013-library-schema/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/library-store.md

**Tests**: required. The spec's success criteria are test outcomes, and integration suites
MUST run (0 skipped) against a real pgvector database.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story (US1, US2, US3)

## Phase 1: Foundational — schema and migration

**Purpose**: the tables, indexes, trigger, and migration every story depends on.

- [x] T001 Create `apps/server/src/schema/library.ts`: `libraryDocuments`, `libraryChunks`,
  `libraryEmbeddings` per data-model.md — uuid PKs, FKs `ON DELETE CASCADE`, unique index on
  `lower(trim(book))`, unique `(document_id, ordinal)`, `kind` CHECK, span CHECK, `dim = 1024`
  CHECK, `vector("embedding", { dimensions: 1024 })`, unique `(chunk_id, model)`, btree on
  `model`, HNSW `vector_cosine_ops` index, and a `customType` tsvector column `tsv`
  `.generatedAlwaysAs(sql\`to_tsvector('english', text)\`)` with a GIN index. Header comment:
  library plane, immutable after ingestion (research R4). `ponytail:` comment on the HNSW index:
  no per-model partial indexes; add when TASK-0029 shows filtered recall dropping.
- [x] T002 Bring up this worktree's stack (`pnpm env:up`), then run
  `pnpm --filter @the-stacks/server db:generate`. In the new `apps/server/drizzle/0002_*.sql`,
  hand-add `CREATE EXTENSION IF NOT EXISTS vector;` as the first statement, and append the
  `library_immutable()` plpgsql function plus `BEFORE UPDATE … FOR EACH ROW` triggers on all
  three tables (research R4). Fix by hand anything drizzle-kit emits wrongly for the generated
  column or HNSW index; note each hand edit in a SQL comment. Apply with
  `pnpm --filter @the-stacks/server db:migrate` against the worktree stack; it must succeed on
  a fresh volume.
- [x] T003 Confirm `pnpm ci:check` passes (typecheck sees the schema; `check:host-scripts`
  still passes; boundary check still 5/5).

**Checkpoint**: migration applies cleanly; tables, indexes, and triggers exist.

## Phase 2: User Story 1 — store a parsed book with verifiable anchors (Priority: P1) 🎯 MVP

**Goal**: `storeParsedBook` stores document + chunks with anchors that round-trip.

**Independent Test**: store a book from the parser's synthetic fixtures; every chunk's stored
span slices the stored text back to the stored chunk text.

- [x] T004 [P] [US1] Write `apps/server/test/library/store.test.ts` (no DB): input validation
  rejects a reversed span, an empty span, a span past `text.length`, and a block whose
  `text.slice(start, end)` differs from its text — each throws `ValidationError` before any
  database call (inject a db double that fails the test if touched).
- [x] T005 [US1] Write `apps/server/test/library/store.integration.test.ts` using the repo's
  loud-skip harness (copy the pattern from `events.integration.test.ts`: `TEST_DATABASE_URL ||
  DATABASE_URL`, `probeReachable`, `REQUIRE_DATABASE=1` throws). US1 cases: parse
  `basic-rules.html` + `bestiary.html` with `parseDdbExport`, store, read back ordered by
  ordinal — count, kind, path, text, spans match, and every span round-trips (contract
  invariants 1, 3, 4); storing the same book again (different letter case) replaces it —
  old chunk ids gone, `replaced: true` (invariant 2); a validation failure mid-book leaves the
  previous version intact (invariant 1 + 2).
- [x] T006 [US1] Implement `apps/server/src/library/store.ts` `storeParsedBook` per
  contracts/library-store.md: Zod-validate, span-check every block, one transaction (lock and
  delete existing by `lower(trim(book))`, insert document with sha-256 `content_hash` via
  `node:crypto`, insert chunks in batches sized under Postgres's 65,535-parameter limit).
  Map unique violations to `ConflictError`. Make T004 and T005 pass.

**Checkpoint**: a parsed book stores and round-trips; replace is atomic.

## Phase 3: User Story 2 — keyword search on every chunk (Priority: P1)

**Goal**: `tsv` is populated automatically and served by the GIN index.

**Independent Test**: store a book; a keyword query finds the one chunk with a unique term;
`EXPLAIN` names the GIN index.

- [x] T007 [US2] Add to `store.integration.test.ts`: after storing, `tsv` is non-null for every
  chunk; `WHERE tsv @@ plainto_tsquery('english', <term unique to one fixture chunk>)` returns
  that chunk (invariant 9); with `SET LOCAL enable_seqscan = off`, `EXPLAIN` of that query
  mentions the GIN index name (SC-002).

**Checkpoint**: keyword search works with no ingestion-side step.

## Phase 4: User Story 3 — embeddings from several models (Priority: P2)

**Goal**: `attachEmbeddings` stores 1024-dim vectors per chunk per model, indexed.

**Independent Test**: two models' vectors on one chunk coexist; a single-model
nearest-neighbour query uses the HNSW index and returns only that model's rows.

- [x] T008 [P] [US3] Add to `store.test.ts` (no DB): `attachEmbeddings` rejects `dim !== 1024`
  and `vector.length !== 1024` with `ValidationError` before any database call (invariant 5).
- [x] T009 [US3] Add to `store.integration.test.ts`: vectors under models `"a"` and `"b"` on one
  chunk both persist with model and dim (AC1); a duplicate `(chunk, model)` raises
  `ConflictError` and the whole call writes nothing (invariant 6); deleting the document
  removes its embeddings (invariant 8); with `SET LOCAL enable_seqscan = off`, `EXPLAIN` of
  `WHERE model = 'a' ORDER BY embedding <=> $1 LIMIT 5` mentions the HNSW index (SC-003). Use
  deterministic synthetic vectors (e.g. from the AI gateway's fake adapter), never a network.
- [x] T010 [US3] Implement `attachEmbeddings` in `store.ts` per the contract (one transaction;
  validation first). Make T008 and T009 pass.

**Checkpoint**: multi-model embeddings stored and searchable per model.

## Phase 5: Immutability and polish

- [x] T011 Add to `store.integration.test.ts`: a raw `UPDATE` on each of the three tables raises
  the `library_immutable` error (invariant 7, SC-004); a raw `DELETE` of a document succeeds
  and cascades.
- [x] T012 Run the full gate with the database required:
  `REQUIRE_DATABASE=1 pnpm ci:check` against this worktree's stack — library integration
  suites report 0 skipped. Save the summary to `specs/013-library-schema/ci-evidence.txt`.
- [x] T013 Wiki: add `docs/wiki/library-schema.md` (sources: `src/schema/library.ts`,
  `src/library/store.ts`, the new migration SQL); review `database-schema` and `migrations`
  against this branch's diff (amend the table count, the extension step, and the trigger
  list, then re-pin); add the note to INDEX.md; regenerate CAPSULES.md. Freshness gate prints
  OK.
- [x] T014 `pnpm env:down`; `pnpm env:prune --check` exits 0.
- [x] T015 After merge: tick this file and run `spec-bridge:sync`.

## Dependencies & Execution Order

- Phase 1 blocks everything.
- US1 (Phase 2) blocks US2 and US3 (they need stored chunks).
- US2 (Phase 3) and US3 (Phase 4) are independent of each other after Phase 2.
- Phase 5 after Phases 2–4.

## Implementation Strategy

MVP = Phases 1–2. Each later phase adds one independently testable guarantee. One
implementer per phase, re-grounded from this spec dir and the branch's commits.
