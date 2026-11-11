---
id: TASK-0313
title: 'Revisit: stakes on Intents'
status: To Do
assignee: []
created_date: '2026-11-11T19:51:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - revisit
milestone: m-11
dependencies: []
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 097 OQ-5 and spec 104 OQ-6: band effects and the free retry (autoSuccess) run beside the Intent path, model-written, which conflicts with constitution II/III. Putting stakes on Intents is an Intent contract minor (C-CON). Trigger: the beside path blocks a card, or TASK-0299 needs stakes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stakes ride the Intent contract (minor version, C-CON recorded) and the planner plans band effects in code.
- [ ] #2 The beside path in resolve.ts is deleted.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
