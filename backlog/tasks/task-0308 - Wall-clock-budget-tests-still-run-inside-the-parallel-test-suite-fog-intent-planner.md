---
id: TASK-0308
title: >-
  Wall-clock budget tests still run inside the parallel test suite (fog, intent,
  planner)
status: In Progress
assignee: []
created_date: '2026-11-11T01:48:00Z'
updated_date: '2026-11-11T01:48:00Z'
labels:
  - ws:tooling
  - replan-2026-11
  - ep-1
  - hotfix
milestone: m-10
dependencies: []
priority: high
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0303 moved space's SC-005 timing test into the serial pnpm check:timing step because turbo's parallel test load fails wall-clock assertions. Three more wall-clock assertions remain inside regular test files and run in parallel: packages/session-model/test/gate-fog.test.ts '64 zones and 12 rows take under 1 ms' (failed main CI at 27f2e6c2 with 1.38 ms, blocking the TASK-0307 deploy), packages/intent/test/property.test.ts p95 < 1 ms, packages/planner/test/determinism.test.ts < 5 ms. Move each into a per-package *.bench-test.ts run by check:timing (budgets unchanged), and add a guard so a regular test file cannot assert on performance.now().
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The fog, intent and planner wall-clock budgets run only in pnpm check:timing, serially, with their thresholds unchanged.
- [ ] #2 A guard fails ci:check when a regular *.test.ts file asserts on a performance.now() duration.
- [ ] #3 main CI is green and vm-104 serves the TASK-0307 fix.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-10 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0308, branch task-0308-timing-tests, cut from origin/main e503b04a. No spec dir: signed escape line covers this task.
<!-- SECTION:NOTES:END -->
