---
id: TASK-0300
title: CI latency gate on fixture tables
status: In Progress
assignee: []
created_date: 2026-11-08 19:56
updated_date: '2026-11-12T13:34:00Z'
labels:
  - ws:tooling
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0268
priority: medium
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Constitution 3.0.0 requires CI to record the time from a confirmed Intent to fact rows on fixture tables. TASK-0278 measures the hosted run only. This card adds the per-commit gate.

Source: docs/design/r1-fast-table-runbook.md finding F5, CP-5 ruling 2026-11-08. Parent epic: TASK-0258. (gap G3).

Spec: specs/106-latency-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `pnpm ci:check` runs a fixture table and records confirmed-Intent-to-fact-rows time.
- [ ] #2 CI fails when the fixture p95 exceeds the budget in the constitution.
- [ ] #3 The gate uses the fake model and needs no provider key.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0300, branch task-0300-latency-gate, cut from origin/main fa6b3c11. Spec number 106 claimed with a stub.
<!-- SECTION:NOTES:END -->
