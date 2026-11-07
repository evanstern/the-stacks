---
id: TASK-0183
title: 'Revisit: cut a plan declaration to its first stage in turn mode'
status: To Do
assignee: []
created_date: '2026-10-30 03:54'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - director
  - revisit
  - replan-2026-11
dependencies:
  - TASK-0182
priority: low
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit card (a maybe). TASK-0182 (spec 064, OQ-5 (a)) cuts a plan-approach-contingency declaration to its first stage in free mode only. In turn mode a declaration still resolves whole. Revisit trigger: a playtest or the TASK-0053 demo shows a turn-mode declaration whose follow-ups resolved in the same beat as the step they depend on. On trigger, spec the turn-mode cut, or drop this card by a decision record. Operator ruling 2026-10-29: "Card the OQ-5 turn-mode revisit."
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger fired and a spec covers the turn-mode cut, or a decision record drops this card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: TASK-0267: one Intent, one plan.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
