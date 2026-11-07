---
id: TASK-0198
title: Index or summary table for the /api/tables session list
status: To Do
assignee: []
created_date: '2026-11-02 06:35'
updated_date: '2026-11-07 05:18'
labels:
  - revisit
  - performance
  - replan-2026-11
dependencies:
  - TASK-0175
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: GET /api/tables (TASK-0175, spec 069) reads from an index or a session summary table instead of scanning events by type.

Why: spec 069 scans events by type with no index beyond the primary key, marked with a ponytail: comment. That is fine at alpha volume. Raised by the spec 069 author, 2026-11-02 (decision-0020: no unplanned deferral).

Trigger: revisit when any environment holds more than 1000 sessions, or the route's p95 exceeds 200 ms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The table list query uses an index or summary table, with an EXPLAIN in the PR
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0279 by replan-2026-11. Table list reads session records.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
