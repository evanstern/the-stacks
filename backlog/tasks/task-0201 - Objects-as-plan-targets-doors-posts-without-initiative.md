---
id: TASK-0201
title: 'Objects as plan targets (doors, posts) without initiative'
status: To Do
assignee: []
created_date: '2026-11-02 14:51'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - revisit
  - replan-2026-11
dependencies:
  - TASK-0194
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a plan step can name an object (a door, a post) as a target, and the object never rolls initiative.

Why: the operator's TASK-0194 ruling says objects join without initiative, but the snapshot has no object ids, so no step can name one. Out of scope for spec 068 (OQ-2, operator accepted the default 2026-11-02).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The snapshot carries object ids a step can target
- [ ] #2 An object target never enters initiative, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0271 by replan-2026-11. Objects are zone features and targets.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
