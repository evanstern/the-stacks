---
id: TASK-0029
title: 'Benchmark system: retrieval quality across embedding models and strategies'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 19:05'
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
