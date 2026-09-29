# Implementation Plan: Hybrid retrieval

**Branch**: `task-0026-hybrid-retrieval` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-hybrid-retrieval/spec.md`

## Summary

Add one read path from a question to cited library passages:
`retrieve(deps, req)` in `apps/server/src/library/retrieve.ts`. It runs a keyword search over
the existing generated `tsv` column, a per-model cosine search over the existing HNSW index, or
both fused with Reciprocal Rank Fusion (k = 60). The question is embedded through the AI
gateway's `embed()` under a configured purpose. Every passage returns its chunk anchor (book,
section path, exact text, UTF-16 span). Mode, result count, and embed purpose come from three
optional env vars with documented defaults. No migration, no new dependency, no HTTP route.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 24 (existing server package)

**Primary Dependencies**: `drizzle-orm` 0.45.3 (`sql` template, `cosineDistance`), `zod`, `pg`
— all installed. **No new runtime dependency.**

**Storage**: Postgres 17 + pgvector 0.8.4 (existing `pgvector/pgvector:pg17` image). Reads
`library_documents`, `library_chunks`, `library_embeddings` from spec 013. No schema change
(research R8).

**Testing**: vitest. Unit tests need no DB. Integration tests follow the repo's loud-skip
harness (`TEST_DATABASE_URL || DATABASE_URL`, `REQUIRE_DATABASE=1` turns a skip into a
failure) and run on this task's own stack from `pnpm env:up`. Model calls use the gateway's
`fake` adapter with scripted vectors (research R9); no network.

**Target Platform**: the existing two-container compose stack

**Project Type**: web service (server package only; no client change)

**Performance Goals**: each search is one indexed query; a hybrid call is one embed call plus
two queries. `EXPLAIN` of retrieval's own queries names the GIN and HNSW indexes.

**Constraints**: every model call through the gateway (constitution IX, decision-0007); vector
dim 1024 (decision-0002); library read-only (constitution III); spans are UTF-16 offsets.

**Scale/Scope**: single tenant; ≤ ~100k chunks; a handful of embedding models per chunk.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents, the answerer (TASK-0027), and the benchmark (TASK-0029)
      all call the one function `retrieve(deps, req)` (contracts/retrieval.md). No human-only
      path; no route is added here.
- [x] **II. Content contract** — not applicable: no codex entity. Results are library rows.
- [x] **III. Data planes** — code lives in `apps/server/src/library/retrieve.ts`, under the
      existing `apps/server/src/library/**` boundary rule. It imports `../ai/gateway.js` as a
      type only and receives the gateway by injection (the gateway is shared infrastructure,
      not a plane). Read-only: no library write (contract invariant 10).
- [x] **IV. Event sourcing** — not applicable: no play state.
- [x] **V. Citations** — every passage carries book, section path, exact text, and span, and
      the round-trip `text.slice(start, end)` is asserted in tests (SC-001). Retrieval evals:
      this task ships fixture-based integration tests of ranking and anchors; the recall
      regression gate is TASK-0029's AC #5, which calls this contract.
- [x] **VI. System-agnostic** — nothing 5e-specific: generic English full-text search and
      cosine similarity over any imported book.
- [x] **VII. Structured first** — not applicable: nothing generated. Results are typed data.
- [x] **VIII. Operator-owned content** — tests use original text built in the test file and
      the parser's synthetic fixtures; retrieval returns stored text only to its caller.
- [x] **IX. Self-hostable** — no new container; pgvector 0.8.4 is already in the image; the
      question embeds through the AI gateway seam; unset retrieval env uses defaults.

**Stack conformance** — Postgres + Drizzle + Zod only. No departure.

**Post-design re-check (after Phase 1)**: all nine still hold. The contract adds no state, no
route, and no dependency.

## Project Structure

### Documentation (this feature)

```text
specs/015-hybrid-retrieval/
├── plan.md              # This file
├── research.md          # Phase 0 decisions R1–R10
├── data-model.md        # Result and config shapes (no new tables)
├── quickstart.md        # How to prove it on this worktree's stack
├── contracts/
│   └── retrieval.md     # retrieve() / fuseRrf() / loadRetrievalConfig() contract
├── checklists/requirements.md
└── tasks.md             # speckit-tasks output
```

### Source Code (repository root)

```text
apps/server/
├── src/
│   ├── library/
│   │   └── retrieve.ts          # NEW: loadRetrievalConfig, fuseRrf, retrieve
│   └── index.ts                 # EDIT: call loadRetrievalConfig(process.env) at boot
└── test/
    └── library/
        ├── retrieve.test.ts               # NEW: config, validation, fuseRrf (no DB)
        └── retrieve.integration.test.ts   # NEW: DB tests, loud-skip harness, fake provider
.env.example                     # EDIT: document RETRIEVAL_* under a "Retrieval" block
docs/wiki/
└── retrieval.md                 # NEW note; library-schema + configuration reviewed
```

**Structure Decision**: one new module beside `store.ts`. `config.ts` is untouched (it must
stay free of relative imports for host scripts; research R5). `index.ts` only validates the
config at boot. It does not construct a retriever, because nothing calls one until TASK-0027.

## Design decisions (summary; detail in research.md)

- **(a) Fusion** (R1): Reciprocal Rank Fusion, `Σ 1/(60 + rank)`, ties by chunk id. Rank-only,
  so the incomparable cosine and `ts_rank_cd` scales need no normalization. k = 60 is the
  paper's and the major engines' default. `ponytail:` upgrade path is a weighted fusion once
  TASK-0029 has data.
- **(b) Keyword search** (R2): `plainto_tsquery('english', q)` with `&` rewritten to `|` (OR
  semantics, no user-controlled syntax), `tsv @@ query`, ranked by `ts_rank_cd`, 50 candidates.
- **(c) Vector search** (R3): one transaction with `SET LOCAL hnsw.iterative_scan =
  strict_order` and `hnsw.ef_search = 100`, `WHERE model = $reportedModel ORDER BY embedding
  <=> $vec LIMIT 50`. Iterative scan stops the shared HNSW index from starving the model filter.
- **(d) Question embedding** (R4): `gateway.embed({purpose: config.embedPurpose, texts:
  [question]})`; filter stored vectors by the model the gateway reports. Tests inject a
  `FakeProvider` through `createGateway`'s `adapters` option and script its vectors.
- **(e) Config** (R5): `RETRIEVAL_MODE` (`hybrid`), `RETRIEVAL_K` (`8`, 1..50),
  `RETRIEVAL_EMBED_PURPOSE` (`embedding`). Zod-parsed; invalid values fail boot.
- **(f) Failure policy** (R6): an unusable embed purpose throws and never degrades to FTS; zero
  vector candidates is reported in `candidates.vector`, not thrown.
- **(g) Anchor** (contract): `anchor` has the parser's `Anchor` shape (`book`, `path`, `start`,
  `end`), so the answerer cites with the same type the parser produced.
- **(h) Migration**: none (R8). **Dependencies**: none new (R10).
- **(i) Host scripts**: `retrieve.ts` is not imported by any host-run script, so
  `check:host-scripts` needs no extension.

## Complexity Tracking

No constitution violations. Deliberate simplifications, each marked with a `ponytail:` comment:
fixed `RRF_K = 60` (R1), fixed `CANDIDATES = 50` (R7), no book filter (spec Assumptions).
