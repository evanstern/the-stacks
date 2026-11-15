---
id: TASK-0356
title: >-
  Auditor dice-lines fails when a narration's dice lines are in a different
  order from the ledger
status: To Do
assignee: []
created_date: '2026-11-15T13:40:00Z'
labels:
  - bug
  - ws:tooling
milestone: m-10
dependencies: []
priority: medium
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 retest (2026-11-15, session 6031b671), run with the full jobs window. dice-lines fails at seq 158, 206 and 248 with 'expected N, found N; first difference at line 1'. At seq 158 the server dice lines show the goblin attack (ledger seq 152) first and the death saves (seq 143, 146) after. The count matches and the order does not. Decide whether the shipped order or the check is wrong.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause is named: the dice-line order in the shipped narration or the check's comparison.
- [ ] #2 A replay of seq 158 from session 6031b671 passes dice-lines after the fix.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
