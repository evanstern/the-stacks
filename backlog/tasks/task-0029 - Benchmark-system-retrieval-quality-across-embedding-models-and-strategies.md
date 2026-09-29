---
id: TASK-0029
title: 'Benchmark system: retrieval quality across embedding models and strategies'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 18:38'
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
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
