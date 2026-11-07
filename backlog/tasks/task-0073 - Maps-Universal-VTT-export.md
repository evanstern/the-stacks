---
id: TASK-0073
title: 'Maps and the Table View: Universal VTT export'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - maps
  - vtt
  - export
  - 'ws:board'
milestone: m-17
dependencies:
  - TASK-0069
priority: medium
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator exports any map as PNG plus Universal VTT JSON (walls, doors, lights, grid).

Why: architecture A8 and A13. UVTT gives value in Foundry, Fantasy Grounds and others even where no live adapter exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Export produces a PNG and a UVTT JSON file for a map.
- [ ] #2 Exported walls, doors and grid match the MapPlan, and a test round-trips sample features.
- [ ] #3 The exported file imports into at least one VTT, recorded with a screenshot in the PR.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
