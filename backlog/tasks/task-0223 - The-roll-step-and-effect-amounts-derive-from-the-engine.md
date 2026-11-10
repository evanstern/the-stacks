---
id: TASK-0223
title: The roll step and effect amounts derive from the engine
status: To Do
assignee: []
created_date: '2026-11-03 05:40'
updated_date: '2026-11-10 03:11'
labels:
  - dm
  - engine
  - rules
  - 'ws:engine'
milestone: m-10
dependencies:
  - TASK-0104
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 082 (TASK-0104) OQ-3: the free roll step and the Amount in effects (heal, damage) stay model-written dice. Derive them from SRD records or stats.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Roll steps and effect amounts carry no model-written number where an SRD record or stat defines one, with tests
- [ ] #2 An Unarmed Strike entry is derived for every combatant (1 + Strength modifier bludgeoning, SRD 5.2.1), so weapon 'unarmed' resolves (spec 097 OQ-12).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): unarmed strikes derived here.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
