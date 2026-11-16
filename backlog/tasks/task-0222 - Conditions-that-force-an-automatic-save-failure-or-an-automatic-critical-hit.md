---
id: TASK-0222
title: Conditions that force an automatic save failure or an automatic critical hit
status: In Progress
assignee: []
created_date: 2026-11-03 05:40
updated_date: '2026-11-16T02:58:00Z'
labels:
  - dm
  - engine
  - rules
  - ws:engine
milestone: m-10
dependencies:
  - TASK-0104
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SRD 5.2.1 conditions that make saves fail automatically (paralyzed, stunned, unconscious on STR/DEX saves) or make hits within 5 ft critical apply through the engine. Spec 082 (TASK-0104) OQ-2 left them out.

Spec: specs/119-condition-auto-fail-crit
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine applies automatic save failure and automatic critical hits from conditions, with engine tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0222, branch task-0222-condition-auto, cut from origin/main f076c127. Spec number 119 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
<!-- SECTION:NOTES:END -->
