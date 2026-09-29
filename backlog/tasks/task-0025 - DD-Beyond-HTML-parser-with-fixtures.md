---
id: TASK-0025
title: D&D Beyond HTML parser with fixtures
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - library
milestone: m-1
dependencies: []
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First-class DDB export parser per A9 and decision-0003.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Committed synthetic fixtures mirror DDB structure with original or SRD 5.1 text
- [ ] #2 Parser emits sections, tables, and stat blocks with anchors
- [ ] #3 A local-only real-export suite runs when fixtures/private exists and skips with a visible notice otherwise
- [ ] #4 fixtures/private is gitignored
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
