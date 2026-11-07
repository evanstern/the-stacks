---
id: TASK-0276
title: Reactions and roll requests
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
labels:
  - 'ws:table-ux'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a reaction policy per reaction (Ask/Auto/Off). Show an inline reaction row to its owner only, with an extendable countdown. Show roll-request rows addressed to the right roller. Absorbs TASK-0218.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-11).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An OA trigger pauses the turn and shows the row to that player only.
- [ ] #2 Timeout defaults to "let it go"; the timer extends per user.
- [ ] #3 Only the addressed player can answer a roll request.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
