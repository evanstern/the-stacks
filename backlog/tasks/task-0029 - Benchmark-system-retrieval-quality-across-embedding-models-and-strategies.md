---
id: TASK-0029
title: 'Benchmark system: retrieval quality across embedding models and strategies'
status: Done
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 22:20'
labels:
  - bench
milestone: m-1
dependencies:
  - TASK-0026
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator requirement (doc-0001, 2026-09-28): compare configurations apples to apples. Replaces the M1 'retrieval eval fixtures in CI' item.

Spec: specs/019-retrieval-bench
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fixed SRD corpus and question set with expected source passages are committed
- [ ] #2 One command runs a matrix over embedding model, dimension, chunking strategy, and retrieval mode
- [ ] #3 Each run reports recall@k, MRR, latency, and embedding cost in a comparable table
- [ ] #4 Results are stored with config and commit so runs compare over time
- [ ] #5 A small fake-provider case runs on every commit and fails on a recall regression; the full matrix runs on demand
- [x] #6 Spec phase: Corpus and question set (AC #1)
- [x] #7 Spec phase: Foundational — load, score, embed helpers (pure)
- [x] #8 Spec phase: User Story 1 — run a matrix and print a comparable table (P1, AC #2, #3)
- [x] #9 Spec phase: User Story 3 — store results and compare over time (P2, AC #4)
- [x] #10 Spec phase: User Story 2 — per-commit recall regression gate (P1, AC #5)
- [ ] #11 Spec phase: Polish, re-grounding, and gates
<!-- AC:END -->











## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~179k tokens). No blocking checkpoint: no schema change (sub-1024 dims truncated+renormalized+zero-padded, model '<model>@<dim>'), no dependency, no workflow change; isolated <db>_bench database. Open checkpoint T026: stop before any paid run with provider/model list + --dry-run estimate. Phase grouping: P1 alone; P2+P3; P4+P5; P6.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 1: SRD 5.1 corpus, 8 docs / 200 KB, 64 questions (83% paraphrase), quote uniqueness checked; PDF sha-256 2504d2a0...; ~478k tokens / 320 tool calls — most costly single phase this sweep, dominated by hand-verifying pdftotext output). Deviation accepted: pdftotext -raw instead of -layout (two-column interleaving).

Operator rulings 2026-09-29 (providers): embeddings use LOCAL Ollama (no paid provider): bge-m3 (1024 dims) and nomic-embed-text (768 dims) pulled and verified via http://localhost:11434/v1/embeddings (openai-compatible kind, no key). Keep models loaded: the bench pins each model with keep_alive:-1 via /api/embed before its cells and runs one model at a time, so reloads never land inside a timed cell. Chat (answering, for TASK-0031) uses 9router at http://localhost:20128/v1 (openai-compatible, subscription-backed, key in the worktree .env set by the operator; cc/claude-sonnet-5 default). No metered spend expected; T026's checkpoint becomes 'confirm the local model list' rather than a cost estimate.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 2-3: load/score/embed/db/run/cli; 10-cell bow matrix prints; 21 tests; 373 pass under REQUIRE_DATABASE=1). Ollama keep-alive warm-up not yet implemented (ruling arrived after the dispatch finished) — carried into the phase 4-5 dispatch.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(resumed phase 2-3 agent via SendMessage for the operator keep-alive ruling: warmUpModel + model-outer runMatrix, commit a4b71c1, +2 tests, 375 pass). Orchestrator note: the phase 4-5 dispatch had also been told to build the warm-up; told it to pull a4b71c1 and not duplicate.

Operator ruling 2026-09-29 (tie-break, option 1): retrieve() breaks score ties deterministically by content — score DESC, then book, then anchor start (then chunk id only as a last resort for exact-duplicate anchors) — replacing the random-UUID tiebreak. Amends specs/015-hybrid-retrieval/contracts/retrieval.md. Rides this task's PR with a determinism test (ingest twice, identical results). The per-commit gate keeps its strict 1/N slack and all three modes.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(tie-break fix 10b5b02: ORDER BY score, book, start_offset, id; fuseRrf takes {chunkId,book,start}; determinism test green; contract 015 amended. Phase 5 523333a: baseline regenerated, ci.json 5x bit-identical, strict gate passes/fails correctly; 380 pass). Orchestrator found retrieval.md pinned to the pre-fix commit (stale per freshness gate) — corrected in phase 6.

T026 real run 2026-09-29 (orchestrator, local Ollama, $0): bge-m3@1024 over block/c1000/c2000/c4000 x vector/fts/hybrid in 1m47s; models stayed pinned (keep_alive -1). Best: c1000 vector R@5 0.953 / MRR 0.836; hybrid trails vector on this corpus (c1000 R@5 0.844); fts best R@5 0.594. nomic-embed-text (768) blocked: gateway enforces 1024 dims (gateway.ts:213) and Ollama ignores 'dimensions' — spec checkpoint (2), carded as follow-up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Corpus and question set (AC #1): 5/5 · Foundational — load, score, embed helpers (pure): 4/4 · User Story 1 — run a matrix and print a comparable table (P1, AC #2, #3): 6/6 · User Story 3 — store results and compare over time (P2, AC #4): 4/4 · User Story 2 — per-commit recall regression gate (P1, AC #5): 3/3 · Polish, re-grounding, and gates: 9/9). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
