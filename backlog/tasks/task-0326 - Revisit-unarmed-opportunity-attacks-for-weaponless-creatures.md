---
id: TASK-0326
title: 'Revisit: unarmed opportunity attacks for weaponless creatures'
status: To Do
assignee: []
created_date: '2026-11-13T02:31:00Z'
labels:
  - ws:engine
  - revisit
milestone: m-11
dependencies:
  - TASK-0223
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 109 OQ-2. TASK-0223 derives Unarmed Strike inside findAttack only, not in stats.attacks, so firstMeleeAttack still finds no melee entry for a weaponless creature, which then never makes an opportunity attack. SRD 5.2.1 lets any creature make an opportunity attack with an Unarmed Strike. Trigger: a seed or playtest has a weaponless creature that a mover leaves reach of.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A weaponless creature makes an opportunity attack with a derived Unarmed Strike, with a scripted-dice engine test.
- [ ] #2 Monster policy choices for seed monsters are unchanged, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
