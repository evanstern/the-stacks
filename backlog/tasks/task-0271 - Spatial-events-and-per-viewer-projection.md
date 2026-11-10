---
id: TASK-0271
title: Spatial events and per-viewer projection
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-10 03:13'
labels:
  - 'ws:space'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0270
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `space.defined`, `actor.placed`, `actor.moved`, `zone.revealed` to the catalog. Fold them into a per-viewer space projection. Add space facts (zone, distance band, reach) to the AI turn context. Scenes declare zones and objects as zone features. Absorbs TASK-0201.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-06).

Spec: specs/100-spatial-events
<!-- SECTION:DESCRIPTION:END -->


## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0201 (Objects as plan targets (doors, posts) without initiative) by replan-2026-11: Objects are zone features and targets.

Operator ruling 2026-11-08 (spec 094 OQs) OQ-10: space.defined, combatant.placed and combatant.moved are ENGINE events from TASK-0270 (mechanics rows, replayed through evolve), not session actor.* events. This card adds zone.revealed and the per-viewer projection only. Rewrite the AC at spec authoring.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0271, branch task-0271-spatial-events, cut from origin/main d639c0e1. Spec number 100 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 100 (16ae6147): zone.revealed v1 (gate-written, public), per-zone party fog applied in planProposal, SessionProjections.spatial, spatialFor/reachOf/targetStatus. 5 phases. Proposed 5 replacement AC in spec.md (applied after the operator rules). Orchestrator-settled: OQ-10/OQ-11 runbook footprint fixes. Operator rulings pending: OQ-1 (the fog rule amends the frozen specs/029 gate contract — blocks Phase 2), OQ-2/3/6/7/8 adopt, OQ-4/12/13/5/9 deferrals.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
