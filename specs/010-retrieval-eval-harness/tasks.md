# Tasks: Retrieval & Evaluation Harness

**Input**: Design documents from `specs/010-retrieval-eval-harness/`
**Prerequisites**: plan.md, research.md (R1–R10), data-model.md, contracts/ (api.md, reranker.md, metrics.md), quickstart.md
**Tests**: TDD is constitutional — every behavior task pairs with a failing-first test task. Write the test, watch it fail, implement the smallest pass.
**Organization**: phases per user story (spec.md P1–P5); every story phase ends at an independently testable checkpoint.
**Format**: `- [ ] T### [P?] [US#?] description with file path` — `[P]` = parallelizable.
**Path Conventions**: monorepo per plan.md — new `packages/retrieval`, plus `packages/db`, `apps/api`, `apps/worker`, `apps/web`, `apps/ml`.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Add the `RETRIEVAL_*` / `RERANKER_*` variables to `.env.example` exactly per contracts/api.md §5 (with teaching comments); confirm `node scripts/mint-worktree-env.mjs --check` reports the drift in an un-updated worktree env (the 009 environment contract at work)
- [x] T002 Scaffold `packages/retrieval` (package.json `@stacks/retrieval`, tsconfig, vitest config, src/index.ts) mirroring `packages/ingestion`'s layout; add to workspace; `pnpm -r run typecheck` green

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 [P] TDD: unit tests for `resolveRetrievalConfig` — defaults from empty env, each override, `RETRIEVAL_RERANK=on` with disabled reranker role REFUSES at resolution (fail-fast, research R9/R10) — in `packages/retrieval/src/config.test.ts`; write first, watch fail
- [x] T004 Implement `packages/retrieval/src/config.ts` (pure core + env reader) to pass T003
- [x] T005 [P] TDD: unit tests for fusion — RRF formula incl. missing-from-one-list handling and rank stability, weighted-sum with normalization, both against hand-computed examples — in `packages/retrieval/src/fusion.test.ts`; write first
- [x] T006 Implement `packages/retrieval/src/fusion.ts` (pure, no DB) to pass T005
- [x] T007 New tables `retrieval_runs`, `retrieval_results`, `gold_items`, `eval_runs` in `packages/db/src/schema/retrieval.ts` per data-model.md (teaching headers citing invariants) + `pnpm --filter @stacks/db generate --name retrieval-tables` migration
- [x] T008 TDD: DB-gated test for `recordRetrievalRun` — one-transaction insert of run+results, and the append-only construction (no update/delete helper exists; grep-able single writer) — in `packages/db/test/retrieval-runs.test.ts` (per-suite DB `db_retrieval_runs`, TASK-8 helper); write first
- [x] T009 Implement `packages/db/src/retrieval-runs.ts` (sole writer, `recordEvent`-style teaching comment) + export from `packages/db/src/index.ts`; T008 green

**Checkpoint**: pure cores + persistence exist — user stories can start.

## Phase 3: User Story 1 — Search the library and get cited passages (Priority: P1) 🎯 MVP

**Goal**: query → fused, attributed, current-generation results in the web UI.
**Independent Test**: fixture corpus ingested; a verbatim-term query and a paraphrase query each place their expected passage top-5 with source attribution and anchors (SC-001).

- [x] T010 [US1] TDD: engine integration test — seed two-source fixture chunks with deterministic embeddings (stub embed client), then: verbatim hit ranks top, paraphrase hit ranks top-5 via vector signal, generation predicate excludes written-aside rows, no-match query returns empty, embedding-stamp mismatch REFUSES (R4) — in `packages/retrieval/src/search.test.ts` (suite DB `retrieval_search`); write first, watch fail
- [x] T011 [US1] Implement `packages/retrieval/src/search.ts`: FTS candidates (`websearch_to_tsquery('english', $q)` + `ts_rank_cd`, R3), vector candidates (exact `<=>` scan, R2), both under the reader predicate; stamp check; fusion (T006); record via `recordRetrievalRun` (query-length clamp per contracts/api.md §1); T010 green
- [x] T012 [US1] TDD: API contract test for `POST /api/retrieval/search` — 401 unauthenticated, 400 `invalid_input` on empty/oversized query, 200 receipt shape per contracts/api.md, 503 `dependency_down` with stubbed-down embed client — in `apps/api/test/retrieval-search.contract.test.ts` (suite DB `api_retrieval_search`); write first
- [x] T013 [US1] Implement `apps/api/src/retrieval/routes.ts` (search route, schema-validated) and wire into `apps/api/src/app.ts`; T012 green
- [x] T014 [US1] Web `/search`: `apps/web/app/routes/search.tsx` (action via `app/lib/api.server.ts` — browser never calls the API), results with passage text, source attribution linking to the source detail view, per-signal scores, honest empty state; "Search" added to primary nav
- [x] T015 [US1] Web test for `/search` in `apps/web` (existing route-test idiom): renders results, empty state, and the nav entry

**Checkpoint**: US1 independently demonstrable (quickstart §1) — the MVP.

## Phase 4: User Story 2 — Every search is a receipt (Priority: P2)

**Goal**: runs list + URL-addressable detail that outlives re-ingestion.
**Independent Test**: perform a search, open its run URL, re-ingest the source (generation flip + sweep), reload the URL — snapshots render, swept passages marked superseded (SC-002).

- [x] T016 [US2] TDD: contract tests for `GET /api/retrieval/runs` (paging shape per 009's listing contract) and `GET /api/retrieval/runs/:id` — including the superseded derivation: seed run, flip generation + sweep, detail marks the swept result — in `apps/api/test/retrieval-runs.contract.test.ts` (suite DB `api_retrieval_runs`); write first
- [x] T017 [US2] Implement runs list + detail in `apps/api/src/retrieval/routes.ts` with the view-time superseded query (data-model.md derivation); T016 green
- [x] T018 [US2] Web `/records/retrievals` (list) and `/records/retrievals/$run` (receipt detail: config, timings, per-stage scores, prerank positions, superseded badges) in `apps/web/app/routes/`; "Retrievals" joins the Records nav section
- [x] T019 [US2] Web tests for both routes

**Checkpoint**: US2 independently demonstrable (quickstart §2).

## Phase 5: User Story 3 — Build a gold set from my own corpus (Priority: P3)

**Goal**: label questions with expected passages; splits enforced; re-ingest honesty.
**Independent Test**: author items against the fixture corpus; splits assigned; changed-text re-ingest flags the item, identical-text re-ingest auto-heals (quickstart §3).

- [x] T020 [US3] TDD: contract tests for gold routes — create resolves chunkId → `{chunkId, sourceId, contentSha256}` and rejects non-current-generation chunks (`invalid_input`), split defaults every-4th-heldout and is immutable on PUT, re-label updates expected list, `needsReconfirmation` derives true after changed-text sweep and false after identical-text re-ingest — in `apps/api/test/evals-gold.contract.test.ts` (suite DB `api_evals_gold`); write first
- [x] T021 [US3] Implement `packages/retrieval/src/gold.ts` domain functions + gold routes in `apps/api/src/retrieval/routes.ts`; T020 green
- [x] T022 [US3] Web `/evals/gold`: authoring flow (mark-as-expected affordance on `/search` results + question entry), list with split badges and the re-confirmation queue, labeling standard visible at authoring time (FR-012) — `apps/web/app/routes/evals.gold.tsx` (+ the search-result affordance in `search.tsx`)
- [x] T023 [US3] Web tests for gold authoring + re-confirmation display

**Checkpoint**: US3 independently demonstrable.

## Phase 6: User Story 4 — Measure before choosing (Priority: P4)

**Goal**: eval runs with pinned metrics; deterministic CI slice; comparison view.
**Independent Test**: two eval runs over the fixture gold set report per-slice metrics side by side; the deterministic suite runs in `pnpm verify` with zero model calls and a pinned floor (quickstart §4–5, SC-004).

- [x] T024 [US4] TDD: unit tests for metrics — recall@5/10, MRR (incl. no-hit ⇒ 0), nDCG@10 (multi-expected ideal ordering), unresolvable exclusion from denominators — each against contracts/metrics.md's hand-computed examples, in `packages/retrieval/src/eval/metrics.test.ts`; write first
- [x] T025 [US4] Implement `packages/retrieval/src/eval/metrics.ts` (pure) to pass T024
- [x] T026 [US4] Fixture: `packages/retrieval/src/eval/fixture/` — synthetic mini-corpus (Principle I: invented content), fixture gold set (≥ 12 items, both splits), and `deterministicEmbedding(text, dims=32)` (hash-seeded, unit-normalized, stamped `provider=fixture` — research R8) with a determinism unit test
- [x] T027 [US4] TDD: `runEval` integration test — executes fixture gold set × two configs, writes `eval_runs` with per-slice metrics, pins `gold_snapshot` (later re-label changes nothing), reports `unresolvable` items separately, each question leaves an `origin:"eval"` retrieval run — in `packages/retrieval/src/eval/run-eval.test.ts` (suite DB `retrieval_eval`); write first
- [x] T028 [US4] Implement `packages/retrieval/src/eval/run-eval.ts` + the `eval_runs` status-transition writer; T027 green
- [x] T029 [US4] Worker: TDD handler test then implement `apps/worker/src/handlers/eval-run.ts` (D12 job: running → completed/failed exactly once, scrubbed error on failure) + registry entry in `apps/worker/src/handlers/registry.ts` — test in `apps/worker/test/eval-run.test.ts` (suite DB `worker_eval_run`)
- [x] T030 [US4] TDD then implement `POST /api/evals/runs` (202 + enqueue) and `GET /api/evals/runs[/:id]` in `apps/api/src/retrieval/routes.ts` — contract test `apps/api/test/evals-runs.contract.test.ts` (suite DB `api_evals_runs`)
- [x] T031 [US4] The deterministic CI slice: `packages/retrieval/src/eval/ci-floor.test.ts` — seeds fixture corpus, runs the harness in-process under `fixture-baseline` config, asserts the PINNED metric floor (values fixed here, cited in the eval report); deliberately breaking fusion must fail it (prove once on a scratch commit, per quickstart §5)
- [x] T032 [US4] Web `/evals`: runs list, run detail (status, per-slice metrics, item outcomes → linked retrieval runs), two-run comparison with deltas — `apps/web/app/routes/evals.tsx`; "Evals" joins nav
- [x] T033 [US4] Web tests for evals list/detail/compare

**Checkpoint**: US4 independently demonstrable — measurement exists.

## Phase 7: User Story 5 — Sharpen the ranking with a reranker (Priority: P5)

**Goal**: env-configured CrossEncoder stage via the sidecar; no silent fallback.
**Independent Test**: rerank off/on same query shows recorded pre/post orderings; sidecar down + rerank on ⇒ honest 503 naming the stage (quickstart §6).

- [x] T034 [US5] TDD: sidecar pytest for `/v1/rerank` — role-disabled 503 `model_not_configured`, wrong-model 404, malformed 415 (empty passages, >256, oversized query), happy path with monkeypatched CrossEncoder scorer, `/ready` reranker states — in `apps/ml/tests/test_rerank.py`; write first
- [x] T035 [US5] Implement `/v1/rerank` + `RERANKER_*` role loading/reporting in `apps/ml/src/ml/` (main.py endpoint, models.py loader, schemas.py request/response) per contracts/reranker.md; pytest + pyright green
- [x] T036 [US5] TDD: `rerank-client.ts` unit test (typed `DomainError`s per status, never returns partial) + engine stage test (on: prerank positions + rerank scores recorded; off: stage marked skipped, no HTTP call; sidecar down + on: `dependency_down`, FR-021) — extend `packages/retrieval/src/search.test.ts` + new `packages/retrieval/src/rerank-client.test.ts`; write first
- [x] T037 [US5] Implement `packages/retrieval/src/rerank-client.ts` + the rerank stage in `search.ts` (config-gated, `RETRIEVAL_RERANK_DEPTH` candidates); T036 green

**Checkpoint**: US5 independently demonstrable — all stories complete.

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T038 [P] Wiki: author `docs/wiki/retrieval.md` (corpus note — engine, receipts, harness doctrine; `sources` + `verified_against` pinned honestly) and add it to `docs/wiki/INDEX.md`; re-verify/re-pin `ingestion.md` only if its listed sources changed
- [x] T039 [P] The eval report (FR-019/SC-005/SC-006): run `rrf-default` vs `weighted-a05` (and rerank on/off where the role is live) over the fixture gold set plus a real gold set of ≥ 30 items; commit `docs/eval-reports/010-retrieval-baseline.md` recording configs, run ids, per-slice metrics, and the shipped-default decision
- [x] T040 Live quickstart walkthrough end-to-end (§1–§7) capturing SC-001..SC-006 evidence for evidence.md; full `pnpm verify` (DB-backed) + `apps/ml` pytest/pyright green; version bump owed check (`node scripts/check-version-bump.mjs --base origin/main`)

## Phase 9: Convergence

- [ ] T041 Run `/speckit-analyze` then `/speckit-converge`; fold any unbuilt work back into this file and complete it
- [ ] T042 Author `specs/010-retrieval-eval-harness/evidence.md`: SC verdict table with live evidence, FR spot-verification, visibility-avenue table (plan.md's, verified live), wiki-impact decision, link to the eval report — the converge-gate record

## Dependencies & Execution Order

```text
Phase 1 (Setup) ──► Phase 2 (Foundational) ──► US1 (P1, MVP)
                                                ├─► US2 (needs runs recorded by US1's engine)
                                                ├─► US3 (needs US1's search surface for labeling UX; gold ROUTES only need Phase 2)
                                                └─► US4 (needs US1 engine + US3 gold items)
                                                        └─► US5 (needs US4 to justify itself; engine seam from US1)
Phase 8 (Polish) needs all stories; T039 benefits from US5. Phase 9 closes.
```

- Story checkpoints: gate + `pnpm verify` + commit + `/spec-bridge:sync` after each phase (the cycle's step-6 protocol).
- Parallel opportunities: T001∥T002; T003∥T005∥T007 (different packages); within stories, web tasks (T014/T018/T022/T032) parallel their API siblings once routes exist; T038∥T039.

## Implementation Strategy

MVP = Phases 1–3 (US1): a working, attributed hybrid search — demonstrable value on its own. Each later story lands as an independently testable increment ending at a checkpoint; US4's deterministic slice (T031) joins `pnpm verify` the moment it exists, putting retrieval correctness under CI for every subsequent task.
