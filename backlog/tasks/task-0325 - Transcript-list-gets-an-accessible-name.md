---
id: TASK-0325
title: Transcript list gets an accessible name
status: To Do
assignee: []
created_date: '2026-11-13T00:46:00Z'
updated_date: '2026-11-13T14:27:00Z'
labels:
  - web
  - ws:table-ux
  - a11y
milestone: m-10
dependencies:
  - TASK-0247
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the TASK-0298 live check (PR #174, specs/108-narration-stream/evidence/live-check.md). The play transcript is a bare <ol>, so the accessibility tree shows an unnamed list. Screen-reader users cannot jump to it by name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The transcript list has an accessible name (e.g. aria-label="Transcript"), with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator C-AMD ruling 2026-11-13 on spec 091: "Approve all". Spec 091 OQ-A13: covered by TASK-0247 FR-011 (stream role=log named "Table stream"). Close with the FR-011 test as evidence once TASK-0247 merges.
<!-- SECTION:NOTES:END -->
