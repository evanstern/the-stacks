---
id: TASK-0030
title: 'Benchmark system: ingest scaling, concurrency, and stress limits'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - bench
milestone: m-1
dependencies:
  - TASK-0024
  - TASK-0021
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator requirement (doc-0001, 2026-09-28): find growing-pain limits before hosting. Produces the recorded measurement decision-0005 requires before any worker split or queue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ingest benchmark measures jobs-table throughput and latency as queued volume grows, and reports where it degrades
- [ ] #2 A concurrency benchmark measures HTTP and WebSocket latency and errors as simulated users grow
- [ ] #3 Stress cases cover database connection exhaustion and app restart mid-ingest
- [ ] #4 Each case declares its tier: every commit, on demand, or against dev only; out-of-tier cases skip with a visible reason
- [ ] #5 Results are stored with config and commit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
