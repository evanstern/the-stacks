---
id: TASK-0275
title: Combat turn UX
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-07 05:19'
labels:
  - 'ws:table-ux'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0266
  - TASK-0274
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show the turn banner with round and economy pips. Show the action bar filtered to what is legal now. In combat, the active player's Enter commits the Intent (P-04). Off-turn Intents from humans are refused with a reason. Absorbs TASK-0248.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pips drain as Intents resolve.
- [ ] #2 The action bar shows only legal actions for the active actor.
- [ ] #3 An off-turn human action is refused with a visible reason.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0248 (A party action can make a human player's character act out of turn) by replan-2026-11: Turn ownership is one rule in combat mode.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
