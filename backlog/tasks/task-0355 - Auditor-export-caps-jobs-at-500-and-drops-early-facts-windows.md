---
id: TASK-0355
title: Auditor export caps jobs at 500 and drops early facts windows
status: In Progress
assignee: []
created_date: '2026-11-15T13:40:00Z'
updated_date: '2026-11-15T14:01:00Z'
labels:
  - bug
  - ws:tooling
milestone: m-10
dependencies: []
priority: high
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 retest (2026-11-15, session 6031b671). exportSession reads listDmJobs(db, sessionId, 500) (apps/server/src/playtest/export.ts:105; harness.ts:300 has the same cap). The session had 577 jobs, so the 77 oldest jobs and their factsThrough windows were dropped. The auditor then fell back to raw segments. deeds-narrated failed on seq 231 and 240, both told by the next narration (spec 115). When the 77 jobs were rebuilt from the debug route, the same run had 0 deeds-narrated fails and 3 dice-lines fails, against 5 before. Fix: page all jobs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The export and the harness read every job of a session, with no fixed cap.
- [x] #2 A test with more than 500 jobs asserts the oldest job's factsThrough reaches jobs.json.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep. Worktree .worktrees/task-0355, branch task-0355-export-all-jobs, cut from origin/main a0658f30. No spec dir: escape line E13 (operator-signed 2026-11-15, "Sign E13") covers this task.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Built: 62214d40 (listDmJobs limit null = no cap; export and harness use it; test export-all-jobs.integration.test.ts with 577 jobs), 8fd7fb4f (wiki re-pins, prose unchanged). Gates: ci:check 0, server suite 1887 passed, boundaries 28/28, wiki plan empty, freshness 0. E13 added to the runbook.
<!-- SECTION:NOTES:END -->
