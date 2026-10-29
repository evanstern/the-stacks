---
id: TASK-0179
title: 'Revisit: operator seats an absent account as DM'
status: To Do
assignee: []
created_date: '2026-10-29 05:10'
labels:
  - play-route
  - revisit
dependencies:
  - TASK-0177
priority: low
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit card (a maybe). TASK-0177 (spec 062, DC-2, OQ-2 (a)) lets the operator seat only users in the presence list, so an account that is not at the table cannot be seated as DM. Revisit trigger: a playtest or the TASK-0053 demo needs a DM seated before that account joins the table. On trigger, spec an operator-only account list for the seat select, or drop this card by a decision record. Operator ruling 2026-10-29: "card DC-2 as a revisit".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger fired and a spec covers an operator-only account list, or a decision record drops this card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
