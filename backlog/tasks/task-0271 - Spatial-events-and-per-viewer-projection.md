---
id: TASK-0271
title: Spatial events and per-viewer projection
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 15:35'
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

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A player projection never contains an unrevealed zone or hidden placement.
- [ ] #2 The AI context lists each actor's zone and who is in reach.
- [ ] #3 A door or post is a valid Intent target.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0201 (Objects as plan targets (doors, posts) without initiative) by replan-2026-11: Objects are zone features and targets.

Operator ruling 2026-11-08 (spec 094 OQs) OQ-10: space.defined, combatant.placed and combatant.moved are ENGINE events from TASK-0270 (mechanics rows, replayed through evolve), not session actor.* events. This card adds zone.revealed and the per-viewer projection only. Rewrite the AC at spec authoring.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0271, branch task-0271-spatial-events, cut from origin/main d639c0e1. Spec number 100 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
