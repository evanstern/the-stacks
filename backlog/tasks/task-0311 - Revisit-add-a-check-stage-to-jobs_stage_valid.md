---
id: TASK-0311
title: 'Revisit: add a check stage to jobs_stage_valid'
status: To Do
assignee: []
created_date: '2026-11-11T18:42:00Z'
labels:
  - replan-2026-11
milestone: m-10
dependencies:
  - TASK-0272
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 103 retired the audit node and runs a check node after narrate. jobs_stage_valid has no check value and spec 103 planned no migration, so apps/server/src/dm/pipeline/runner.ts writes stage narrate while the check runs (ponytail comment). Trigger: the next task that ships a migration touching the jobs table, or a debug/ops need to tell narrate time from check time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 jobs_stage_valid accepts check, and runner.ts writes stage check while the check node runs.
- [ ] #2 The ponytail comment in runner.ts is removed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
