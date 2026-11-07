---
id: TASK-0155
title: 'Revisit: windowed event fetch on the debug page for long sessions'
status: To Do
assignee: []
created_date: '2026-10-27 04:34'
updated_date: '2026-11-07 05:17'
labels:
  - revisit
  - debug-view
  - web
  - deferred
milestone: m-18
dependencies: []
priority: low
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when a play session's event log passes a few thousand rows, or the debug page's memory or first-load time is reported slow. Context: TASK-0117 (specs/041-debug-page) loads the whole log up front (1000 per page) and folds all of it client-side. Carded 2026-10-27 by the M3 sweep orchestrator under decision-0020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision picks a windowed fetch and fold strategy with a measured threshold
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. Trigger stays: debug page load time.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
