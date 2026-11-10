---
id: TASK-0271
title: Spatial events and per-viewer projection
status: Done
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-10T04:51:00Z'
labels:
  - ws:space
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
- [x] #1 No row a player receives and no player projection holds an unrevealed zone or a placement in one.
- [x] #2 A player's folded spatial projection equals the one derived from the DM projection for the same log.
- [x] #3 Party moves, arrivals and fog crossings reveal the zones they name with a public zone.revealed in the same write.
- [x] #4 The AI context lists each placed combatant's zone and who is in its reach; the seat and fiction views omit unrevealed zones.
- [x] #5 Seeds declare zones, and a revealed door or post resolves as an entity target that never enters initiative.
- [x] #6 Phase 1: Event and projection (US1, US4; AC #2, #5) (specs/100-spatial-events tasks.md)
- [x] #7 Phase 2: The fog rule in the gate (US1, US2; AC #1, #2, #3) (specs/100-spatial-events tasks.md)
- [x] #8 Phase 3: Seeds and the DM runtime (US4; AC #5) (specs/100-spatial-events tasks.md)
- [x] #9 Phase 4: Zones and reach in the AI context (US3; AC #4) (specs/100-spatial-events tasks.md)
- [x] #10 Phase 5: Wiki (specs/100-spatial-events tasks.md)
- [ ] #11 Spec phase: Event and projection (US1, US4; AC #2, #5)
- [ ] #12 Spec phase: The fog rule in the gate (US1, US2; AC #1, #2, #3)
- [ ] #13 Spec phase: Seeds and the DM runtime (US4; AC #5)
- [ ] #14 Spec phase: Zones and reach in the AI context (US3; AC #4)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0201 (Objects as plan targets (doors, posts) without initiative) by replan-2026-11: Objects are zone features and targets.

Operator ruling 2026-11-08 (spec 094 OQs) OQ-10: space.defined, combatant.placed and combatant.moved are ENGINE events from TASK-0270 (mechanics rows, replayed through evolve), not session actor.* events. This card adds zone.revealed and the per-viewer projection only. Rewrite the AC at spec authoring.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0271, branch task-0271-spatial-events, cut from origin/main d639c0e1. Spec number 100 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 100 (16ae6147): zone.revealed v1 (gate-written, public), per-zone party fog applied in planProposal, SessionProjections.spatial, spatialFor/reachOf/targetStatus. 5 phases. Proposed 5 replacement AC in spec.md (applied after the operator rules). Orchestrator-settled: OQ-10/OQ-11 runbook footprint fixes. Operator rulings pending: OQ-1 (the fog rule amends the frozen specs/029 gate contract — blocks Phase 2), OQ-2/3/6/7/8 adopt, OQ-4/12/13/5/9 deferrals.

AC rewritten per spec 100 (operator approved, 2026-11-09).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-5)
Phases dccde3cc, 4996584b, a18da0cc, f1676535, dfebbb55, 359b9cf1. Fog rule in the gate; frozen specs/029 gate-api.md amended (operator ruling 2026-11-09, spec 100 OQ-1). Orchestrator ran the FULL server suite with REQUIRE_DATABASE=1 against this worktree's test DB: 163 files / 1912 tests pass, 5 skipped (load bench). The implementer's run had hung; it was load from a parallel suite. env:down and env:prune --check done. PR held for spine order (#11).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (merge main + 0274 fog coverage)
Merged main twice (with 0245, 0267, 0274). Fog covers combatant.depart (its before-zone keeps it dm in fog) and combatant.side (names no zone), tested. Two DB tests needed a second d20: the party is gathered into the one-zone reed camp, so close-combat disadvantage applies to every ranged attack (carded as TASK-0306 for a rules ruling). Server with REQUIRE_DATABASE=1: 1979 pass / 5 skipped. ci:check exit 0. Orchestrator re-ran the fog tests (18) and freshness (OK 65).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Event and projection (US1, US4; AC #2, #5): 9/9 · The fog rule in the gate (US1, US2; AC #1, #2, #3): 7/7 · Seeds and the DM runtime (US4; AC #5): 7/7 · Zones and reach in the AI context (US3; AC #4): 4/4 · Wiki: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
