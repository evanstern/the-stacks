---
id: TASK-0328
title: 'Intent path: integration test for an NPC pulled into initiative'
status: To Do
assignee: []
created_date: '2026-11-13T05:31:00Z'
labels:
  - ws:intent
  - test-coverage
milestone: m-10
dependencies:
  - TASK-0312
ordinal: 312000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0312 phase 4 deleted resolve.ts pullIn and its TASK-0213 integration tests (Pell pulled into initiative; dice lines for the joiner). The planner unit tests cover pull-in (packages/planner/test kinds/checks/combat), but no intent-runner integration test asserts the joiner enters initiative with its dice lines end to end.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An intent-runner integration test pulls an NPC target into an encounter and asserts it joins initiative
- [ ] #2 The test asserts the joiner's initiative dice line appears in the turn facts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
