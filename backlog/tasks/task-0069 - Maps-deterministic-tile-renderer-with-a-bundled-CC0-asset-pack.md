---
id: TASK-0069
title: >-
  Maps and the Table View: deterministic tile renderer with a bundled CC0 asset
  pack
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - maps
  - 'ws:board'
milestone: m-14
dependencies:
  - TASK-0068
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a MapPlan renders to a PNG deterministically from a bundled CC0 tile and asset pack.

Why: architecture A8. The same plan and seed always give the same image, so maps are regenerable and testable. CC0 assets keep the project free of licensing duties.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The renderer draws a PNG from a MapPlan, and the same plan and seed give byte-identical output.
- [ ] #2 The asset pack is CC0, and its license file ships with it.
- [ ] #3 Rendered walls, doors and grid line up with the plan's coordinates, and a test checks sample cells.
- [ ] #4 Rendering runs as a job on the jobs queue.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
