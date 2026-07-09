# Implementation Plan: Extensible Ingestion Service

**Branch**: `008-ingestion-service` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-ingestion-service/spec.md`

## Summary

Build the ingestion pipeline the spec defines — intake → detect → extract → transform →
chunk → embed → index — entirely on the walking skeleton's proven seams: the Postgres
jobs queue (`@stacks/db` `queue.ts`, D12), the append-only-by-construction event pattern
(`events.ts`, Principle IV), the four-class `DomainError` taxonomy mapped to HTTP only in
`apps/api/src/app.ts`, the env-first `embedding` model role (D14), and the ML sidecar's
`POST /v1/embed` contract. The pivotal new artifact is the versioned **normalized
document** contract (FR-018) in `@stacks/ingestion-contract`, which graduates from its
placeholder; plugins (D&D Beyond, Markdown/plain-text, generic HTML — FR-028) live in a
new `@stacks/ingestion-plugins` package that is structurally unable to touch the DB or
model providers (FR-014, enforced by `check-boundaries.mjs`). Pipeline core lives in a
new `@stacks/ingestion` package driven by worker job handlers; the API gains upload
intake + ticket-status routes; the web app gains a minimal upload + status surface
(FR-027). Re-ingestion uses generation-flip replacement so readers never see a
half-swapped source (FR-023).

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 22 (all new code). Python 3.12 sidecar is
consumed, not modified.

**Primary Dependencies**: Fastify 5 (+ `@fastify/multipart` for upload intake), Drizzle
ORM 0.36 / drizzle-kit migrations, React Router 7 framework mode, vitest 2; new parsing
deps confined to `@stacks/ingestion-plugins`: `cheerio` (HTML extraction),
`sanitize-html` (display artifacts), `yauzl` (streaming ZIP). Embeddings via the
existing ML sidecar HTTP contract — no new model dependency.

**Storage**: PostgreSQL 16 + pgvector (existing compose service). Source archives stored
as content-addressed `bytea` rows (research R1) — one store, one backup story, and intake
can commit archive + source + job enqueue in a single transaction. New tables: sources,
source_archives, batches, document_sections, chunks (with un-dimensioned `vector` column
+ tsvector FTS), ingestion_events, plugin registry stamp columns.

**Testing**: vitest across packages; DB-gated integration suites behind
`RUN_DB_INTEGRATION_TESTS=1` (skeleton convention); fixture-driven plugin tests with
synthetic DDB-shaped fixtures (Principle I); the plugin **conformance suite** exported
from `@stacks/ingestion-contract` and run against every shipped plugin (FR-015);
`pnpm verify` (boundaries + tsc + vitest) stays the gate.

**Target Platform**: Docker compose, the existing five services — no new service
(Principle VI). API and worker both grow; ml and postgres are consumed as-is.

**Project Type**: Web application (monorepo: Fastify API + worker + RR7 SSR web +
shared packages).

**Performance Goals**: Intake (submit → claim ticket) < 2 s within the size cap (SC-002);
embedding batched ≤ `EMBED_MAX_BATCH` (64) per sidecar call; ingestion of the DDB fixture
set completes unattended (SC-001) — throughput beyond that is not a goal at
single-operator scale.

**Constraints**: Append-only event trails (sole-writer construction); deterministic
chunk/vector identities and idempotent indexing (retryable at any point, SC-004); no
hardcoded model identifiers (D14, boundary-checked); plugins cannot import `@stacks/db`
or call providers (FR-014, boundary-checked); no proprietary content in fixtures
(Principle I); upload size cap env-configured (`INGEST_MAX_UPLOAD_BYTES`, default 25 MB).

**Scale/Scope**: Single operator; corpora of order 10³–10⁴ chunks; individual sources up
to the size cap; exactly one live corpus with `corpus_id` carried everywhere (FR-022).

## Constitution Check

*GATE: constitution v2.1.0. Evaluated pre-Phase-0 and re-evaluated post-design.*

| Gate | Principle / Decision | Status | Notes |
|---|---|---|---|
| G1 | I — Lawful content only | ✅ PASS | All fixtures synthetic DDB-shaped look-alikes (FR-024, SC-010); no scraping/downloading paths anywhere in design; v2's `ddb_import.py` knowledge is ported from git history as *rules/selectors*, never as content |
| G2 | II — Hallucination containment | ✅ PASS (n/a surface) | No model-facing chat surface in this feature; anchors + provenance built here are what later citation validation stands on |
| G3 | III — Citations are receipts | ✅ PASS | Traceability chain is explicit contract: chunk → section anchor → source → immutable archive; plugin+version stamped per source (FR-016); new ingesters only via the contract (FR-013/015) |
| G4 | IV — Async + guarded | ✅ PASS | All post-intake work via jobs table; retries safe by deterministic IDs + idempotent writes; no destructive verbs in scope (FR-025 fences corpus lifecycle out); events append-only by construction |
| G5 | V — Operator observability | ✅ PASS | Claim ticket → status + full event trail (FR-010); minimal upload/status UI (FR-027) URL-addressable; full Records surface deliberately deferred to its own spec |
| G6 | VI — Boring, bounded infra | ✅ PASS | No new services, no broker, no object store; Postgres holds queue, archives, sections, chunks, vectors, FTS; plugins/pipeline split into packages along the existing boundary-check seam |
| G7 | VII — Config over hardcoding | ✅ PASS | Embed stage resolves the existing `embedding` role at boot; identity stamped per chunk row (FR-020); chunking parameters env-tunable for the eval program (FR-019) |
| G8 | VIII — The work must teach | ✅ PASS (deferred deliverable) | Teaching-register comments throughout; cycle closes with `/spec-cycle-course` artifact under `docs/courses/008-ingestion-service/` |
| G9 | D1–D14 fixed decisions | ✅ PASS | D2 (TS owns pipeline; sidecar inference-only), D4 (corpus id carried; archives immutable), D5 (pgvector + FTS in Postgres), D12 (jobs table), D14 (env-first roles). No decision reopened → no ADR required |
| G10 | Workflow — TDD | ✅ PASS | Contract/conformance tests and fixture-driven plugin tests are the natural failing-test-first surface; DB-gated integration tests for queue/idempotency |
| G11 | Workflow — wiki impact | ✅ PASS (planned) | Durable architecture (normalized-document contract, plugin seam, generation-flip) gets a `docs/wiki/Ingestion.md` page linked from Home at convergence |

**Pre-Phase-0 result**: PASS — no violations, Complexity Tracking not needed.

**Post-design re-check (after Phase 1)**: PASS — design added two packages
(`@stacks/ingestion`, `@stacks/ingestion-plugins`) along the exact boundary Principle VI
fixes (plugins must be structurally DB-blind); both are shared-package additions inside
the existing monorepo layout, not new services. No gate status changed.

## Project Structure

### Documentation (this feature)

```text
specs/008-ingestion-service/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R13
├── data-model.md        # Phase 1 — tables, state machines, ID scheme
├── quickstart.md        # Phase 1 — SC-001..010 validation guide
├── contracts/
│   ├── normalized-document.md   # FR-018 — the pivotal versioned contract
│   ├── plugin-contract.md       # FR-013/014/015 — interface + conformance
│   ├── api.md                   # upload intake + ticket status endpoints
│   └── events.md                # ingestion event vocabulary
└── tasks.md             # Phase 2 (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── core/src/                    # + ingestion error causes if needed (reuse 4 classes)
├── db/src/
│   ├── schema/ingestion.ts      # NEW: corpora, batches, sources, source_archives,
│   │                            #      document_sections, chunks, ingestion_events
│   ├── ingestion-events.ts      # NEW: recordIngestionEvent (sole writer, mirrors events.ts)
│   └── migrations/              # + 000X_ingestion migration (drizzle-kit generate)
├── ingestion-contract/src/      # GRADUATES from placeholder: NormalizedDocument v1,
│   │                            #   IngestionPlugin, DetectResult, chunking hints,
│   │                            #   failure categories
│   └── conformance/             # NEW: exported vitest conformance suite (FR-015)
├── ingestion/src/               # NEW package @stacks/ingestion — pipeline core:
│   ├── registry.ts              #   plugin registry + detection dispatch (FR-011/012)
│   ├── chunking.ts              #   structure-aware packing, env-tunable (FR-019)
│   ├── embed.ts                 #   batched sidecar client via embedding role (FR-020)
│   ├── index-chunks.ts          #   deterministic-ID idempotent indexing (FR-021)
│   └── ingest-source.ts         #   stage driver: detect→…→index + events (FR-007)
└── ingestion-plugins/src/       # NEW package @stacks/ingestion-plugins (DB-blind):
    ├── ddb/                     #   D&D Beyond saved-HTML (rules ported from v2 history)
    ├── markdown/                #   Markdown/plain-text fallback
    ├── html/                    #   generic-HTML fallback
    └── fixtures/                #   synthetic fixtures (Principle I)

apps/
├── api/src/
│   └── ingestion/routes.ts      # NEW: POST /v1/uploads, GET /v1/uploads/:ticket (+ app.ts wiring)
├── worker/src/handlers/
│   ├── ingest-batch-expand.ts   # NEW: ZIP → per-source rows + jobs (R10)
│   └── ingest-source.ts         # NEW: thin handler delegating to @stacks/ingestion
└── web/app/routes/
    ├── library.upload.tsx       # NEW: upload form (FR-027)
    └── library.uploads.$ticket.tsx  # NEW: status + event trail view

scripts/check-boundaries.mjs     # + rules: ingestion-plugins may import ONLY
                                 #   @stacks/ingestion-contract (+ its own deps);
                                 #   nothing outside plugins imports parsing libs
```

**Structure Decision**: Extend the existing pnpm monorepo with two shared packages split
exactly at the constitutional boundary — `@stacks/ingestion` (core: DB, queue, sidecar,
chunking policy) vs `@stacks/ingestion-plugins` (pure transforms: bytes in, normalized
document out). The worker stays a thin dispatcher (existing `registry.ts` pattern); the
API stays the only HTTP-mapping site; the web app talks only through
`app/lib/api.server.ts` (FR-019 of 007, unchanged).

## Complexity Tracking

No constitution violations — table intentionally empty.
