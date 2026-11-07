---
id: TASK-0071
title: 'Maps and the Table View: AI DM drives tokens and fog'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - table-view
  - dm
  - 'ws:board'
milestone: m-15
dependencies:
  - TASK-0070
priority: medium
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the AI DM places and moves monster and NPC tokens and reveals fog as part of its turn, through the gate.

Why: the AI-run table (goal 3) must use the map the humans see. Movement and reveal are engine-checked proposals, like every other state change (decision-0015, decision-0017).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resolve emits token-move and reveal proposals, and the gate checks them against walls and movement.
- [ ] #2 The Director places the encounter's tokens when the table enters turn mode.
- [ ] #3 Narration about positions agrees with token events, and audit checks it.
- [ ] #4 Tests run a turn with scripted dice in which a monster moves and a door reveals a room.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
