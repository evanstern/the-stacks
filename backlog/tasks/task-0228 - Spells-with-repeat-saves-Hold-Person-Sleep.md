---
id: TASK-0228
title: Spells with repeat saves (Hold Person, Sleep)
status: Done
assignee: []
created_date: '2026-11-03T08:01:00Z'
updated_date: '2026-11-28T04:20:22Z'
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

Spec: specs/125-spell-repeat-saves-hold-person
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hold Person applies paralyzed and the target repeats its save at the end of each of its turns, ending on a success, with engine tests
- [x] #2 Spec phase: Engine repeat saves (FR-001–FR-007; AC #1)
- [x] #3 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
D24 (decision-0032) TREATMENT arm. Spec allocated by PM: specs/125-spell-repeat-saves-hold-person. Owner: Rules Engine Engineer (Kimi). Blocked on TASK-0360 (kimi tier) before any implementer dispatch. Record D24 metrics in final summary; Dispatch: tier=kimi pinned=kimi/kimi-for-coding served=<run-receipt model>.

D24-A1 (CTO, 2026-11-28): moved off Kimi arm after repeated ACPX sidecar failures on INF-14; runs on Sonnet; Kimi arm = TASK-0229 only.

spec-bridge sync: Engine repeat saves (FR-001–FR-007; AC #1): 5/5 · Wiki: 1/1 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-11-28T04:12:34Z

---

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=sonnet (Agent model override; exact served id not exposed in hand-back, unverified)

---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine repeat saves (FR-001–FR-007; AC #1): 5/5 · Wiki: 1/1). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
