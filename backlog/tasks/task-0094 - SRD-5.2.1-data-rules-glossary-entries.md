---
id: TASK-0094
title: 'SRD 5.2.1 data: rules glossary entries'
status: To Do
assignee: []
created_date: '2026-10-26 01:55'
updated_date: '2026-11-07 05:17'
labels:
  - srd
  - data
  - deferred
milestone: m-18
dependencies:
  - TASK-0043
priority: medium
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the SRD 5.2.1 Rules Glossary entries other than conditions (which TASK-0043 ships) ship as Zod-validated records in packages/srd, so adjudication can cite them compactly.

Why: operator ruling 2026-10-25 at TASK-0043 plan checkpoint C2: these SRD 5.2.1 kinds stay out of TASK-0043 and get their own ordered cards (decision-0020). They extend the packages/srd package, source, attribution and provenance checks that TASK-0043 sets up (specs/027-srd-data).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The repo ships every SRD 5.2.1 Rules Glossary entry that is not a condition as a Zod-validated record, loadable by id and by name.
- [ ] #2 Each record carries a source reference to its SRD 5.2.1 page and passes the TASK-0043 provenance and PDF verification checks.
- [ ] #3 Each record has a compact lookup form within the TASK-0043 size bound.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. Glossary; trigger: a "why" expansion needs a missing entry. Absorbs 0137.

Merged from TASK-0137 (Revisit: the rest of the SRD 5.2.1 Rules Glossary in packages/srd) by replan-2026-11: Same glossary scope.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
