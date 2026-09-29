# Implementation Plan: Library schema

**Branch**: `task-0022-library-schema` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-library-schema/spec.md`

## Summary

Add the library plane's three tables — `library_documents`, `library_chunks`,
`library_embeddings` — as a Drizzle schema plus one generated migration with hand-added SQL
for what Drizzle cannot express (the `vector` extension, the immutability trigger, and the
span/text consistency check). Two write functions in `apps/server/src/library/store.ts`
(`storeParsedBook`, `attachEmbeddings`) are the only way content enters the library; each is
one transaction. Keyword search is a generated `tsvector` column with a GIN index; meaning
search is an HNSW index over `vector(1024)` with cosine distance, one row per chunk per model.
No new dependency.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 24 (existing server package)
**Primary Dependencies**: `drizzle-orm` 0.45.3 (has `vector()`, `index().using("hnsw", …op("vector_cosine_ops"))`, `cosineDistance`), `drizzle-kit` 0.31, `pg` 8.23, `zod` — all installed. **No new dependency.**
**Storage**: Postgres 17 with pgvector (existing `pgvector/pgvector:pg17` image)
**Testing**: vitest; integration suites follow the repo's loud-skip harness (`TEST_DATABASE_URL || DATABASE_URL`, `REQUIRE_DATABASE=1` turns a skip into a failure — set in CI). Locally they run against this task's own stack from `pnpm env:up`.
**Target Platform**: the existing two-container compose stack
**Project Type**: web service (server package only; no client change)
**Performance Goals**: store an ~8,000-chunk book (PHB scale) in one transaction; keyword and vector lookups use their indexes (visible in `EXPLAIN`)
**Constraints**: library immutable after ingestion (A3, constitution III); vector dim fixed at 1024 (decision-0002); spans are UTF-16 code-unit offsets, the same unit the parser and JS `String.slice` use
**Scale/Scope**: single tenant; tens of books; ≤ ~100k chunks; a handful of embedding models per chunk

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents and ingestion call the same two functions in
      `library/store.ts` (`storeParsedBook`, `attachEmbeddings`); no human-only path.
- [x] **II. Content contract** — not applicable: no codex entity is created. Library
      rows are imported text, not authored entities.
- [x] **III. Data planes** — all new state is library-plane: tables prefixed `library_`,
      code under `apps/server/src/library/`, covered by the existing
      `apps/server/src/library/**` boundary rule (no codex/session imports). Immutability is
      enforced by a database trigger (research R4).
- [x] **IV. Event sourcing** — not applicable: no play state.
- [x] **V. Citations** — every chunk stores book (via its document), section path, and a
      `[start, end)` span; a CHECK plus a store-time assertion guarantee
      `substring(text, start+1, end-start) = chunk.text` (research R5). This task changes
      storage, not retrieval; retrieval evals ship with TASK-0026/TASK-0029.
- [x] **VI. System-agnostic** — block `kind` is the parser's generic vocabulary
      (`statBlock` is a text shape, not a mechanic). No 5e rule logic.
- [x] **VII. Structured first** — not applicable: nothing generated. (Embeddings record
      model and dim, which is this feature's analogue of provenance.)
- [x] **VIII. Operator-owned content** — tests use the parser's synthetic
      original/SRD fixtures only; imported text lives only in the operator's DB volume.
- [x] **IX. Self-hostable** — uses the pgvector image already in `docker-compose.yml`; the
      migration creates the extension; no new container.

**Stack conformance** — Postgres + Drizzle + Zod only. No departure.

## Project Structure

### Documentation (this feature)

```text
specs/013-library-schema/
├── plan.md              # This file
├── research.md          # Phase 0 decisions R1–R8
├── data-model.md        # Tables, columns, constraints, indexes
├── quickstart.md        # How to prove it on this worktree's stack
├── contracts/
│   └── library-store.md # storeParsedBook / attachEmbeddings contract
├── checklists/requirements.md
└── tasks.md             # speckit-tasks output
```

### Source Code (repository root)

```text
apps/server/
├── src/
│   ├── schema/
│   │   └── library.ts          # NEW: Drizzle tables for the library plane
│   └── library/
│       ├── store.ts            # NEW: storeParsedBook, attachEmbeddings
│       └── ddb/                # existing parser (input shape)
├── drizzle/
│   ├── 0002_<generated>.sql    # NEW: generated + hand-added SQL (R2, R4, R5)
│   └── meta/                   # updated by drizzle-kit
└── test/
    └── library/
        ├── store.test.ts               # NEW: pure input-validation tests (no DB)
        └── store.integration.test.ts   # NEW: DB tests, loud-skip harness
docs/wiki/
└── library-schema.md          # NEW note; database-schema + migrations reviewed
```

**Structure Decision**: schema files live in `apps/server/src/schema/` (where
`drizzle.config.ts` looks, beside `events.ts` and `auth.ts`); library logic lives in the
library plane directory the boundary rule already guards.

## Design decisions (summary; detail in research.md)

- **(a) Three tables, embeddings separate** (R1). `library_documents` (one per book),
  `library_chunks` (ordinal, kind, path, text, start/end, generated `tsv`),
  `library_embeddings` (chunk FK, model, dim, `vector(1024)`, unique `(chunk_id, model)`).
  Separate embeddings table because decision-0002 requires several models per chunk and a
  re-embed that never touches chunk rows.
- **(b) FTS** (R3): `tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED`
  + GIN index. Generated, so ingestion cannot forget it.
- **(c) Vector index** (R2): HNSW with `vector_cosine_ops`. HNSW needs no training data and
  can be created on an empty table, so it works from the first migration; IVFFlat must be
  built after data exists or recall collapses. Cosine because embedding models are trained
  for cosine similarity and it is insensitive to vector norm across providers.
  Model filtering is a plain `WHERE model = ?` over a btree on `model`; per-model partial
  HNSW indexes are deferred until one table holds several models at scale (ponytail).
- **(d) Immutability** (R4): `BEFORE UPDATE` trigger on all three tables raises, mirroring
  `events`. DELETE is allowed (wholesale replace and operator removal) and cascades
  documents → chunks → embeddings via `ON DELETE CASCADE`. Replace = delete + insert in one
  transaction.
- **(e) Migration workflow** (R6): `pnpm --filter @the-stacks/server db:generate` then hand-add
  `CREATE EXTENSION IF NOT EXISTS vector;` at the top, the trigger function + triggers, and
  the span CHECK. Commit the SQL. Integration tests run against this worktree's stack
  (`pnpm env:up`, then `TEST_DATABASE_URL` from the generated `.env`); CI sets
  `REQUIRE_DATABASE=1`.
- **(f) Boundary** (R7): existing `apps/server/src/library/**` rule already forbids
  codex/session imports; `schema/library.ts` imports only drizzle. No new rule; the boundary
  fixture count stays 5/5.
- **(g) Dependencies**: none new (verified in the installed drizzle-orm 0.45.3).

## Complexity Tracking

No constitution violations. One deliberate simplification, marked in code with a
`ponytail:` comment: no per-model partial vector indexes (see (c)).
