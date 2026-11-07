---
id: TASK-0280
title: Projection snapshots
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-07 05:15'
labels:
  - 'ws:memory'
  - replan-2026-11
  - ep-2
milestone: m-11
dependencies:
  - TASK-0279
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Checkpoint `SessionProjections` every N events and at session close. Gate, ws subscribe and the browser load from the latest snapshot. Absorbs TASK-0153.

Parent epic: TASK-0259.

Source: docs/design/replan-2026-11/board-rework-map.md (N-15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gate load time is flat across a 5 000-event session.
- [ ] #2 Snapshot + tail fold equals a full fold (property test).
- [ ] #3 The pre-turn snapshot is exact across a reclaimed turn.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
