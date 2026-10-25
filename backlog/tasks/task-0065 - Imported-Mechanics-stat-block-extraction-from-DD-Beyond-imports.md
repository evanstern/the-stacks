---
id: TASK-0065
title: 'Imported Mechanics: stat block extraction from D&D Beyond imports'
status: To Do
assignee: []
created_date: '2026-10-25 20:17'
labels:
  - mechanics
  - library
  - parser
milestone: m-5
dependencies:
  - TASK-0064
priority: medium
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: monster stat blocks in an imported D&D Beyond book become engine monster records, each citing its source passage.

Why: decision-0012. With only the SRD, the AI DM cannot run a monster from the operator's own books. The DDB parser (M1) already keeps tables and headings; extraction builds on its blocks, not on raw HTML.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extraction turns each recognized stat block into a contract-valid engine monster record.
- [ ] #2 Each record cites its source book, section and passage.
- [ ] #3 An extraction report lists every stat block found, extracted or rejected, with the reason for each rejection.
- [ ] #4 Fixtures are synthetic or SRD-based, per decision-0003.
- [ ] #5 Re-importing a book replaces its extracted records without duplicates.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
