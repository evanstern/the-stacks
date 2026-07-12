# Implementation Plan: Retrieval & Evaluation Harness

**Branch**: `010-retrieval-eval-harness` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-retrieval-eval-harness/spec.md`

## Summary

Query-side hybrid retrieval over the corpus 008 built: one query fans out to the
chunks table's two existing signals — the generated `fts` tsvector (GIN-indexed) and
the pgvector `embedding` column — and the two candidate lists fuse into one ranking by
reciprocal-rank fusion (research R1), optionally re-ordered by a reranker model served
from the ML sidecar behind a new `/v1/rerank` contract. Every retrieval writes an
append-only receipt (`retrieval_runs` + `retrieval_results`, snapshot text included)
that outlives generation sweeps; runs are operator-visible at `/records/retrievals`.
The evaluation harness (D11) closes the loop: operator-authored gold sets with a
tuning/held-out split, pinned recall@k / MRR / nDCG (contracts/metrics.md), eval runs
as queue jobs, a deterministic fixture-corpus slice wired into `pnpm verify` for
per-PR CI, and the shipped fusion/rerank defaults justified by a committed eval
report before this cycle converges.

## Technical Context

**Language/Version**: TypeScript (Node ≥ 22) for engine/API/UI; Python 3.12 for the
sidecar's rerank endpoint only (D2).

**Primary Dependencies**: Fastify 5 (API routes), React Router 7 SSR (web surfaces),
Drizzle + pg (new tables/queries), FastAPI + sentence-transformers CrossEncoder
(sidecar rerank), Vitest (all TS tests), pytest/pyright (sidecar).

**Storage**: the existing single Postgres (D5/VI): new tables `retrieval_runs`,
`retrieval_results`, `gold_items`, `eval_runs`; reads against 008's `chunks` (GIN FTS
+ pgvector, generation predicate). No ANN index this cycle (research R2).

**Testing**: TDD per constitution — pure cores (fusion, metrics, config resolution)
unit-tested without a DB; engine/API against per-suite databases
(`ensureSuiteDatabase`, TASK-8); the deterministic eval slice IS a test (runs in
`pnpm verify`); sidecar rerank via pytest with a stub model.

**Target Platform**: the compose stack (five services, unchanged topology).

**Project Type**: web service + web UI inside the existing monorepo.

**Performance Goals**: SC-003 — query → ranked results < 2 s on the reference corpus,
including query embedding via sidecar; deterministic eval slice adds < 30 s to CI.

**Constraints**: no new services (VI); no hardcoded model ids (VII — reranker role is
env-first like embedding); browser never calls the API (FR-019/007-era rule);
retrieval-run tables append-only BY CONSTRUCTION (single insert helper, no
UPDATE/DELETE path); no proprietary content in fixtures (I).

**Scale/Scope**: single operator; reference corpus ~10⁴–10⁵ chunks (seq-scan vector
search acceptable, R2); gold sets ~30–200 items; ~5 new API routes, 3 new web
surfaces, 1 new sidecar endpoint, 1 new package.

## Constitution Check

*Gate evaluated against constitution v2.3.0 before Phase 0; re-checked after Phase 1.*

| # | Gate | Verdict | Evidence |
|---|---|---|---|
| G1 | I — lawful content only | ✅ PASS | Fixture corpus + fixture gold set are synthetic (FR-024); operator gold sets stay in their DB, never committed |
| G2 | II — hallucination contained | ✅ PASS (by scope) | No model-generated prose ships; this spec builds the retrieval layer II depends on |
| G3 | III — citations are receipts | ✅ PASS | retrieval_runs/results append-only, snapshot text, chunk→section→anchor chain preserved (data-model.md); runs replayable after sweeps (FR-009) |
| G4 | IV — slow async, destructive guarded | ✅ PASS | Interactive search is sub-2s sync; eval runs are jobs on the D12 queue (accept-then-async); nothing destructive ships — runs/gold items are append/flag-only |
| G5 | V — operator control & observability | ✅ PASS | Visibility-avenue table below; all operator surfaces nav-reachable + URL-addressable |
| G6 | VI — boring bounded infra | ✅ PASS | Zero new services; new tables in the one Postgres; sidecar gains an endpoint, stays inference-only |
| G7 | VII — configuration over hardcoding | ✅ PASS | `RETRIEVAL_*` + `RERANKER_*` env-first (contracts/api.md §5); embedding-space mismatch refused via the 008 stamp (FR-005); defaults eval-justified (D11, SC-005) |
| G8 | VIII — the work must teach | ✅ PASS (planned) | Teaching-register code; course at close via /spec-cycle-course; wiki note `retrieval.md` at convergence (wiki-impact decision) |
| G9 | Workflow — TDD | ✅ PASS (planned) | Failing-first tests pinned in tasks; pure cores testable without DB |
| G10 | Workflow — wiki impact | ✅ PASS (planned) | New corpus note `docs/wiki/retrieval.md` + re-pin `ingestion.md` if its sources change |
| G11 | D1–D14 | ✅ PASS | D2 (rerank in sidecar, inference-only), D5 (hybrid on pgvector — the payoff), D11 (harness), D12 (eval jobs), D13 (single operator), D14 (no hardcoded models) |

**Visibility avenues (Principle V, per capability)**:

| Capability | Avenue | Why |
|---|---|---|
| Search | Web UI `/search`, in nav | The operator-facing act itself |
| Retrieval-run receipts | Web UI `/records/retrievals` (list) + `/records/retrievals/:id` (detail), in nav | Records-style, URL-addressable |
| Gold-set authoring/curation | Web UI `/evals/gold` (list/author), flags visible | Operator-facing labeling work |
| Eval runs & comparison | Web UI `/evals` (runs list, run detail, A/B compare) | Operator reads measurements |
| Deterministic CI slice | CI output + vitest locally (`pnpm verify`) | Developer-facing machinery — no web surface warranted |
| Reranker serving | Sidecar `/ready` reports reranker state; run records carry model identity | Background machinery + receipts |

**Post-Phase-1 re-check**: design artifacts introduce no new violations — same verdicts.

## Project Structure

### Documentation (this feature)

```text
specs/010-retrieval-eval-harness/
├── plan.md              # This file
├── research.md          # Phase 0 — R1..R10 decisions
├── data-model.md        # Phase 1 — tables, entities, invariants
├── quickstart.md        # Phase 1 — end-to-end validation guide
├── contracts/
│   ├── api.md           # HTTP surface + env/config contract
│   ├── reranker.md      # Sidecar /v1/rerank contract
│   └── metrics.md       # Pinned metric definitions (FR-015)
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
packages/retrieval/            # NEW — the engine (DB/model-facing, like @stacks/ingestion)
├── src/
│   ├── config.ts              # RETRIEVAL_*/RERANKER_* env-first resolution (pure core + env reader)
│   ├── search.ts              # hybrid query: FTS + vector candidates → fusion → (rerank) → results
│   ├── fusion.ts              # PURE: reciprocal-rank fusion (unit-tested, no DB)
│   ├── rerank-client.ts       # sidecar /v1/rerank client (typed DomainErrors, no fallback)
│   ├── record-run.ts          # append-only run+results writer (the ONLY writer)
│   ├── gold.ts                # gold-item create/list/flag domain functions
│   ├── eval/
│   │   ├── metrics.ts         # PURE: recall@k, MRR, nDCG per contracts/metrics.md
│   │   ├── run-eval.ts        # execute gold set × config → eval_runs row
│   │   └── fixture/           # synthetic corpus + gold set + deterministic embeddings
│   └── *.test.ts              # colocated Vitest suites (per-suite DBs where gated)
packages/db/src/schema/retrieval.ts   # NEW tables (+ migration via drizzle-kit)
packages/db/src/retrieval-runs.ts     # insert helpers, append-only by construction
apps/api/src/retrieval/               # routes: search, runs, gold, eval (contracts/api.md)
apps/worker/src/handlers/eval-run.ts  # D12 job handler for eval executions
apps/ml/src/ml/main.py                # + /v1/rerank endpoint (contracts/reranker.md)
apps/web/app/routes/                  # search.tsx, records.retrievals.tsx,
                                      # records.retrievals.$run.tsx, evals.tsx, evals.gold.tsx
.env.example                          # + RETRIEVAL_*/RERANKER_* (env contract addendum, api.md §5)
```

**Structure Decision**: a new `packages/retrieval` mirrors `packages/ingestion`'s
station: it owns everything DB/queue/model-facing on the query side, keeps pure cores
(fusion, metrics) dependency-free for unit testing, and leaves HTTP mapping to
`apps/api` (errors stay `DomainError`s until the boundary). `check-boundaries.mjs`
gains no new rules — existing ones (no web→db, no hardcoded models) already cover the
new package.

## Complexity Tracking

No constitution violations to justify — the section stays empty by design.
