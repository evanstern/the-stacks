---
id: TASK-0277
title: Targeting, life state and zone chips
status: To Do
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-13T14:27:00Z'
labels:
  - ws:table-ux
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0329
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`@` targeting lists in-range targets by distance with an HP word. Margin shows life state, conditions with duration, death-save slots, and zone chips that draft moves. Absorbs TASK-0252.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-12).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dead, down and stable are visible as words and colour.
- [ ] #2 Clicking a zone chip drafts a `move` pill.
- [ ] #3 Targets out of reach are marked, not hidden.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0252 (The table shows no life state: players can't tell which foes are dead or down) by replan-2026-11: Life state chips.

Operator C-AMD ruling 2026-11-13 on spec 091: "Approve all". Spec 091 OQ-A10: add range order, the HP word and the out-of-reach mark to the shared target listbox; zone chips call draft(seed). Hold until TASK-0329 merges.
<!-- SECTION:NOTES:END -->
