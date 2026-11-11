---
id: TASK-0310
title: Test end_turn Intent with ai:dm as the actor
status: To Do
assignee: []
created_date: '2026-11-11T14:41:00Z'
labels:
  - ws:intent
  - replan-2026-11
milestone: m-10
dependencies:
  - TASK-0268
ordinal: 294000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The spec 102 gate plans an end_turn Intent through the shared floor-end code (gate/floor-end.ts endTurnRows). No test covers ai:dm as the actor in turn mode, including the AI-DM absence marker. Found while implementing TASK-0268 (PR #166).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session-model gate test plans end_turn from ai:dm while an NPC is the active actor and asserts the floor-end rows.
- [ ] #2 The test covers the AI-DM absence marker case, or the card notes why none applies.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
