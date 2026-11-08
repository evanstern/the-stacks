---
id: TASK-0270
title: Space package and zones in the engine
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-08 20:11'
labels:
  - 'ws:space'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `packages/space` with zones, edges, range bands, and reach checks. Add `placement` to engine combatants and a `move` command. Absorbs TASK-0139.

Prerequisite checkpoints: CP-1 (plan-of-action §7).

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-05).

Spec: specs/094-space-and-zones
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Engine `move` refuses blocked edges and over-speed moves.
- [ ] #2 Reach and range checks use bands without a grid.
- [ ] #3 Golden-dice tests cover OA triggers from leaving an engaged band.
- [ ] #4 The package has no renderer or React dependency.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0139 (Revisit: track position and range as actor state) by replan-2026-11: Positions and range are the zone model.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0270, branch task-0270-space-zones, cut from origin/main a8bda4ab. Spec number 094 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
