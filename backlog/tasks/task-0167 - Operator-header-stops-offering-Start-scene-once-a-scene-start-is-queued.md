---
id: TASK-0167
title: Operator header stops offering Start scene once a scene start is queued
status: In Progress
assignee: []
created_date: '2026-10-28 07:59'
updated_date: '2026-10-28 22:44'
labels:
  - play-route
milestone: m-3
dependencies: []
priority: medium
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: after the operator starts a scene, the table header stops offering "Start scene" while the scene-start suggestion is pending. Evidence: the TASK-0159 spec author (spec 055, 573cafc) found that TASK-0163 canStart checks model.scene === null. With a human DM the scene-start suggestion stays pending, so the header still shows "Start scene" and "Scene start queued.", and a second start gets 409. Why it matters: the TASK-0163 alpha run and the TASK-0053 human-DM run both start scenes this way.

Spec: specs/059-start-scene-queued
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The header hides or disables Start scene once the session has a queued or pending scene start, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0167, branch task-0167-start-scene-queued, cut from origin/main ba18aaf7. Spec 059 authored at 21be5ba9: one server predicate sceneStartState (none | queued | pending | started) drives both the start route 409 and a new operator-only GET /dm/sessions/:id/start that the header reads; TableView drops its local startQueued flag. The author found that with a human DM a second start is accepted today (no 409) and re-proposes the opening moves; T003 is a red-first DB test for it. No frozen contract change, no new frame, no modal. Open questions OQ-1 to OQ-4 go to the operator.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
