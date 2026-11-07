---
id: TASK-0296
title: Retrieval over chronicle and notebook
status: To Do
assignee: []
created_date: '2026-11-07 05:14'
updated_date: '2026-11-07 05:15'
labels:
  - 'ws:memory'
  - replan-2026-11
  - ep-7
milestone: m-16
dependencies:
  - TASK-0280
  - TASK-0084
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Index chronicle, journal and notebook prose with the library's hybrid retrieval, filtered by visibility before ranking. `assemble` and `ask_dm` read it within a token budget.

Parent epic: TASK-0264.

Source: docs/design/replan-2026-11/board-rework-map.md (N-31).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A player never retrieves an unrevealed block.
- [ ] #2 "Who was that innkeeper" answers from session 1 in session 3.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
