---
id: TASK-0228
title: Spells with repeat saves (Hold Person, Sleep)
status: To Do
assignee: []
created_date: '2026-11-03T08:01:00Z'
updated_date: '2026-11-27T03:38:28Z'
labels:
  - engine
  - rules
  - dm
  - ws:engine
  - exp:d24-treatment
milestone: m-12
dependencies:
  - TASK-0105
  - TASK-0360
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) TREATMENT arm. Spec allocated by PM: specs/125-spell-repeat-saves-hold-person. Owner: Rules Engine Engineer (Kimi). Blocked on TASK-0360 (kimi tier) before any implementer dispatch. Record D24 metrics in final summary; Dispatch: tier=kimi pinned=kimi/kimi-for-coding served=<run-receipt model>.
<!-- SECTION:NOTES:END -->
