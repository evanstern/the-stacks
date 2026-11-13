---
id: TASK-0331
title: 'Revisit: move FactRow and the row renderer to session-model'
status: To Do
assignee: []
created_date: '2026-11-13T14:27:00Z'
labels:
  - debt
  - ws:table-ux
  - revisit
dependencies: []
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From spec 091 OQ-A5 (Operator C-AMD ruling 2026-11-13 on spec 091: "Approve all".); spec 098 OQ-2's trigger fired. TASK-0247 formats roll rows in the web from ledger rows. Trigger: web and server row wordings drift in a playtest. Then move FactRow and the renderer out of apps/server facts.ts into session-model and share it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Trigger checked after the R1 playtest and the result is recorded on this card.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
