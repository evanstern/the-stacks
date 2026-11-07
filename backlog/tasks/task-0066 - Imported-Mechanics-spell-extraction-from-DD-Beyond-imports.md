---
id: TASK-0066
title: 'Imported Mechanics: spell extraction from D&D Beyond imports'
status: To Do
assignee: []
created_date: '2026-10-25 20:17'
updated_date: '2026-11-07 05:16'
labels:
  - mechanics
  - library
  - parser
  - deferred
milestone: m-18
dependencies:
  - TASK-0064
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: spells in an imported D&D Beyond book become engine spell records, each citing its source passage.

Why: decision-0012. Spells drive slot use, saves and damage in play; the engine resolves only what it has records for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extraction turns each recognized spell into a contract-valid engine spell record.
- [ ] #2 Each record cites its source book, section and passage.
- [ ] #3 An extraction report lists every spell found, extracted or rejected, with the reason for each rejection.
- [ ] #4 Fixtures are synthetic or SRD-based, per decision-0003.
- [ ] #5 Re-importing a book replaces its extracted records without duplicates.
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
