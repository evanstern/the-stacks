---
id: TASK-0064
title: 'Imported Mechanics: layered mechanics records over the SRD baseline'
status: To Do
assignee: []
created_date: '2026-10-25 20:17'
updated_date: '2026-11-07 05:16'
labels:
  - mechanics
  - engine
  - library
  - deferred
milestone: m-18
dependencies:
  - TASK-0063
references:
  - docs/design/architecture.md
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the engine and the DM runtime resolve a monster or spell by name through one layered lookup: the operator's imported records first, the SRD 5.2.1 baseline second.

Why: decision-0012 layers extracted import records over the SRD in the same record shapes. Extracted records live in the library plane, in the operator's volume (architecture A3, A9). The extractors (TASK-0065, TASK-0066) write into this store.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Imported mechanics records are stored in the library plane with a reference to their source document and passage.
- [ ] #2 One lookup resolves a name to the imported record when one exists, and to the SRD record otherwise.
- [ ] #3 A lookup result states which layer it came from.
- [ ] #4 Deleting an imported book removes its extracted records, and lookups fall back to the SRD.
- [ ] #5 Compact lookup records exist for imported records, within the same size bound as the SRD ones.
- [ ] #6 Imported records never leave the operator's volume, and no test fixture contains proprietary text.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. P-21. Trigger: SRD monster list blocks a generator or playtest.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
