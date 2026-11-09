---
id: TASK-0270
title: Space package and zones in the engine
status: Done
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 05:50'
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
- [x] #1 Engine `move` refuses blocked edges and over-speed moves.
- [x] #2 Reach and range checks use bands without a grid.
- [x] #3 Golden-dice tests cover OA triggers from leaving an engaged band.
- [x] #4 The package has no renderer or React dependency.
- [x] #5 Phase 1: packages/space, biome override, boundary fixtures (specs/094 tasks.md)
- [x] #6 Phase 2: engine placement, speed, space; space.define, combatant.place, move, movement.action
- [x] #7 Phase 3: reach and range by band in attack.roll; SRD speed/reach/range in seeds
- [x] #8 Phase 4: provokers() with golden-dice opportunity-attack tests
- [x] #9 Phase 5: wiki re-ground (merge main first; new space note)
- [ ] #10 Spec phase: The space package (US4, AC #4)
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0139 (Revisit: track position and range as actor state) by replan-2026-11: Positions and range are the zone model.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0270, branch task-0270-space-zones, cut from origin/main a8bda4ab. Spec number 094 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 094 committed (7c475539). Operator ruling 2026-11-08 (spec 094 OQs): OQ-10 engine events (combatant.*), OQ-1 same zone = engaged, OQ-2 only the origin zone provokes; OQ-3 and OQ-4 moved to TASK-0274.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-2)
Phases 1-2 done (980f28de, 4a2aa690): packages/space; engine space/placement/speed, space.define, combatant.place, move, movement.action; 7 refusal codes (OUT_OF_REACH, OUT_OF_RANGE move to Phase 3 with their tests). space 28, engine 367, session-model 839 tests pass; boundary 21/21.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 3-4)
Phases 3 (5bb0de98) and 4 (426a317d) done: OUT_OF_REACH/OUT_OF_RANGE (44 codes), band checks in attack.roll, SRD speed/reach/range in seeds, 6 golden-dice OA tests. engine 381, space 28, session-model 839, server dm 945 pass; 5 adjudicate DB failures predate TASK-0138's fix (branch cut before #146), cleared by the phase 5 main merge.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 5)
Phase 5 done (eda32108 merge, c7a73935 wiki): new space note; 7 notes prose-updated, 5 re-pinned unchanged (orchestrator spot-checked seeds: only speed:30). pnpm ci:check exit 0 (DB suites skipped). Orchestrator re-ran freshness OK 62, plan empty. PR held: spine #5, behind 0273.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (merge main after TASK-0273)
Merge dea1a12b: the 4 wiki conflicts were pin lines only; prose auto-merged. Re-ground 5e481aa4: dm-runtime, overview, playtest-harness re-pinned after diff review. ci:check rc 0 (server 1385 pass, DB skipped). Orchestrator re-ran freshness OK 62, plan empty, no conflict markers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The space package (US4, AC #4): 12/12 · Engine placement, space and move (US1, AC #1): 12/12 · Reach and range by band, and SRD mapping (US2, AC #2): 6/6 · Opportunity attacks from leaving an engaged band (US3, AC #3): 2/2 · Wiki re-ground: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
