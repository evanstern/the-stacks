---
id: TASK-0067
title: 'Imported Mechanics: extraction review panel and milestone demo'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - mechanics
  - ui
  - acceptance
  - deferred
milestone: m-18
dependencies:
  - TASK-0065
  - TASK-0066
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator reviews extracted records against their source passages, and the M5 demo runs.

Demo: import a book with a monster not in the SRD; the engine runs it in a fight; its stat block cites the imported page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator lists a book's extracted records and its extraction report.
- [ ] #2 The operator opens a record beside its cited source passage.
- [ ] #3 The panel uses slide-out panels and autocomplete dropdowns only, never modals.
- [ ] #4 Demo: the AI DM runs a fight with an imported non-SRD monster, and the ledger shows its stats came from the import.
- [ ] #5 The demo record is committed under docs/.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. P-21. Same trigger.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
