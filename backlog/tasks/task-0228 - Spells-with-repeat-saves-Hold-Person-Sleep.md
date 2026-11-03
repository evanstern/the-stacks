---
id: TASK-0228
title: 'Spells with repeat saves (Hold Person, Sleep)'
status: To Do
assignee: []
created_date: '2026-11-03 08:01'
labels:
  - engine
  - rules
  - dm
milestone: m-3
dependencies:
  - TASK-0105
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) OQ-2: spells whose effect repeats a save each turn are refused SPELL_UNRESOLVED. Model the repeat save at the target's turn end.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hold Person applies paralyzed and the target repeats its save at the end of each of its turns, ending on a success, with engine tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
