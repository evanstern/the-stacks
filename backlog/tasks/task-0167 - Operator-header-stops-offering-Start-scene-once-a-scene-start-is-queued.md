---
id: TASK-0167
title: Operator header stops offering Start scene once a scene start is queued
status: To Do
assignee: []
created_date: '2026-10-28 07:59'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The header hides or disables Start scene once the session has a queued or pending scene start, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
