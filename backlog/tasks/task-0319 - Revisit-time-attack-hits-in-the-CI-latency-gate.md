---
id: TASK-0319
title: 'Revisit: time attack hits in the CI latency gate'
status: To Do
assignee: []
created_date: '2026-11-12T13:43:00Z'
labels:
  - ws:tooling
  - revisit
milestone: m-11
dependencies:
  - TASK-0300
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 106 OQ-1: the TASK-0300 latency gate scripts every attack to miss, so the damage-roll path (attack.resolved with damage, hp change) is never timed. A dying target would cause refusals mid-sample. Trigger: the fixture world can reset hit points between samples, or a hosted run shows damage resolution near the 1 s budget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The latency gate times attack hits (damage applied) as their own kind under the same 1 s p95 budget.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
