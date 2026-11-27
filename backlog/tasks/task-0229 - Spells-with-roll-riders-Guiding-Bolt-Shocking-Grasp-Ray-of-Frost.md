---
id: TASK-0229
title: Spells with roll riders (Guiding Bolt, Shocking Grasp, Ray of Frost)
status: To Do
assignee: []
created_date: '2026-11-03T08:01:00Z'
updated_date: '2026-11-27T03:38:29Z'
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
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) OQ-2: spells whose hit adds a rider (advantage on the next attack, no reactions, speed reduction) are refused SPELL_UNRESOLVED.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Guiding Bolt's advantage rider and Shocking Grasp's no-reactions rider apply through the engine, with tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) TREATMENT arm. Spec allocated by PM: specs/126-spell-roll-riders-guiding-bolt-shocking-grasp. Owner: Rules Engine Engineer (Kimi). Blocked on TASK-0360 (kimi tier) before any implementer dispatch. Record D24 metrics in final summary; Dispatch: tier=kimi pinned=kimi/kimi-for-coding served=<run-receipt model>.
<!-- SECTION:NOTES:END -->
