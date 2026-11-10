---
id: TASK-0271
title: Spatial events and per-viewer projection
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 18:22'
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

From spec 098 OQ-9: add a position fact row (who moved, from which zone to which) to the fact sheet when spatial events land.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
