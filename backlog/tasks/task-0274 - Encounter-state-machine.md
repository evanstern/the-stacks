---
id: TASK-0274
title: Encounter state machine
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-07 05:19'
labels:
  - 'ws:engine'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0270
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the encounter a live engine state: start, join, leave, flee, end and resume. Absorbs TASK-0253, 0254.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-09).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fight ended by truce resumes with a fresh turn order when broken.
- [ ] #2 A fled combatant leaves the order and its zone.
- [ ] #3 Joining mid-fight rolls initiative for the newcomer only.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0253 (A fight can't resume once its encounter has ended: a broken truce gets no turn order) by replan-2026-11: Encounter resume.

Merged from TASK-0254 (A combatant who fled keeps its turn and gets contradictory facts) by replan-2026-11: Fled combatant leaves the order.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
