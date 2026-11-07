---
id: TASK-0092
title: 'SRD 5.2.1 data: magic items'
status: To Do
assignee: []
created_date: '2026-10-26 01:55'
updated_date: '2026-11-07 05:17'
labels:
  - srd
  - data
  - 'ws:engine'
milestone: m-15
dependencies:
  - TASK-0043
priority: medium
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the SRD 5.2.1 magic items ship as Zod-validated records in packages/srd, through the same loader and compact forms as TASK-0043.

Why: operator ruling 2026-10-25 at TASK-0043 plan checkpoint C2: these SRD 5.2.1 kinds stay out of TASK-0043 and get their own ordered cards (decision-0020). They extend the packages/srd package, source, attribution and provenance checks that TASK-0043 sets up (specs/027-srd-data).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The repo ships every SRD 5.2.1 magic item as a Zod-validated record, loadable by id and by name.
- [ ] #2 Each record carries a source reference to its SRD 5.2.1 page and passes the TASK-0043 provenance and PDF verification checks.
- [ ] #3 Each record has a compact lookup form within the TASK-0043 size bound.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Re-homed by replan-2026-11. Magic items feed the loot generator.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
