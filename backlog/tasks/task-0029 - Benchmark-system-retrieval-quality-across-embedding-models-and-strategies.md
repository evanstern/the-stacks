---
id: TASK-0029
title: 'Benchmark system: retrieval quality across embedding models and strategies'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 21:15'
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
- [ ] #6 Spec phase: Corpus and question set (AC #1)
- [ ] #7 Spec phase: Foundational — load, score, embed helpers (pure)
- [ ] #8 Spec phase: User Story 1 — run a matrix and print a comparable table (P1, AC #2, #3)
- [ ] #9 Spec phase: User Story 3 — store results and compare over time (P2, AC #4)
- [ ] #10 Spec phase: User Story 2 — per-commit recall regression gate (P1, AC #5)
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
