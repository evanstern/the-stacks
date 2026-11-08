---
id: TASK-0231
title: >-
  Split the dnd5e-engine and dm-failure-and-gates wiki notes under the size
  budget
status: To Do
assignee: []
created_date: '2026-11-03 08:28'
updated_date: '2026-11-07 05:18'
labels:
  - wiki
  - docs
  - 'ws:tooling'
milestone: m-10
dependencies: []
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 083 (TASK-0105) pushed both notes past the 8000-character budget (8582 and 8430); each took a size_budget_exempt line. Split each into two notes by concept so neither needs the exemption, and remove the exemption lines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dnd5e-engine and dm-failure-and-gates each fit the 8000-character budget with no size_budget_exempt line, and the freshness gate passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
