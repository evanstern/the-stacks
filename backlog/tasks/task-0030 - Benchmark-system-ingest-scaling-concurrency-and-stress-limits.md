---
id: TASK-0030
title: 'Benchmark system: ingest scaling, concurrency, and stress limits'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 19:53'
labels:
  - bench
milestone: m-1
dependencies:
  - TASK-0024
  - TASK-0021
  - TASK-0033
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator requirement (doc-0001, 2026-09-28): find growing-pain limits before hosting. Produces the recorded measurement decision-0005 requires before any worker split or queue.

Spec: specs/021-load-bench
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ingest benchmark measures jobs-table throughput and latency as queued volume grows, and reports where it degrades
- [ ] #2 A concurrency benchmark measures HTTP and WebSocket latency and errors as simulated users grow
- [ ] #3 Stress cases cover database connection exhaustion and app restart mid-ingest
- [ ] #4 Each case declares its tier: every commit, on demand, or against dev only; out-of-tier cases skip with a visible reason
- [ ] #5 Results are stored with config and commit
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-29: now also depends on TASK-0033 (operator ruling): the ingest benchmark polls the jobs queue, so it needs the DB-only test stack to avoid the app worker stealing jobs.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
