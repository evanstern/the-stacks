---
id: TASK-0161
title: 'Actor-state gate: Check model-written roll reasons at the plan gate'
status: To Do
assignee: []
created_date: '2026-10-27 19:52'
labels:
  - dm
  - rules-gate
dependencies:
  - TASK-0143
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a roll reason the DM model writes cannot contradict actor state, because the plan gate checks it before resolve logs it.

Why: operator ruling 2026-10-27 on TASK-0143 OQ-1 (a): model-written roll reasons stay out of U3's output gate, and this follow-up card checks them at the plan gate. Resolve logs the reason on the dice line before narrate runs, and the log is append-only. Evidence: M2 seq 221, step reason "shouting that two kin have fallen", shipped on the seq 225 dice line while only one goblin had died. Use the TASK-0143 checker (spec 051).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The plan gate runs the TASK-0143 actor-state checker on every model-written roll reason before resolve logs it.
- [ ] #2 A refused reason feeds the existing plan refusal path, with a test over M2 seq 221.
- [ ] #3 A reason the checker passes ships unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
