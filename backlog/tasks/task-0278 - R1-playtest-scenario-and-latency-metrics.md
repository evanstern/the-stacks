---
id: TASK-0278
title: R1 playtest scenario and latency metrics
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 00:16'
labels:
  - 'ws:tooling'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0272
  - TASK-0275
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write the R1 combat scenario (four PCs, four goblins, zones). Add latency metrics to the auditor: Intent-to-fact-row p95, first narration token p50, round wall time.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The auditor reports the three latency metrics.
- [ ] #2 The scenario runs hosted under the playtest-run skill.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline playtest 2026-11-08 (pre-R1, vm-104 at 25ea6bc8). Ceiling: $25 (operator, in chat: "$25"). Scenario: reed camp, solo plus AI companions. Measures R1 metrics plus B2 rows rolled forward.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
