---
id: TASK-0267
title: Deterministic planner
status: Done
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-10T04:02:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0266
  - TASK-0270
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `packages/planner` with `plan(state, space, intent)` returning commands, a refusal, or a ruling request. Port the deterministic half of `dm/nodes/resolve.ts` and `dm/gates/plan-gate.ts`. Cover checks, saves, contests, attacks, the six engine spells, dash, dodge, disengage, help, hide, move and resource kinds.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-02).

Spec: specs/097-planner
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The planner makes no model call and no I/O (boundary lint).
- [x] #2 Golden tests cover each supported kind, each refusal code and each ruling request.
- [x] #3 Legality checks from TASK-0145 and TASK-0147 pass as planner tests.
- [x] #4 Phase 1: Package skeleton, types, boundary and kind table (AC #1) (specs/097-planner tasks.md)
- [x] #5 Phase 2: Checks and the ruling loop (US2, AC #2) (specs/097-planner tasks.md)
- [x] #6 Phase 3: Combat actions (US1, AC #2) (specs/097-planner tasks.md)
- [x] #7 Phase 4: Movement, turn, resources and DM control (US1, US3, AC #2) (specs/097-planner tasks.md)
- [x] #8 Phase 5: Legality, coverage and determinism (US3, AC #2, AC #3) (specs/097-planner tasks.md)
- [x] #9 Phase 6: Wiki re-ground (specs/097-planner tasks.md)
- [ ] #10 Spec phase: Package skeleton, types, boundary and kind table (AC #1)
- [ ] #11 Spec phase: Checks and the ruling loop (US2, AC #2)
- [ ] #12 Spec phase: Combat actions (US1, AC #2)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: AC #4 (resolve.ts loses ported paths) moved to TASK-0269. This task ships the pure package with golden tests only.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0267, branch task-0267-planner, cut from origin/main d639c0e1. Spec number 097 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 097 (a34d5d39): packages/planner, PlanState, 28 served kinds, PlanFact, RulingRequest, 6 phases. Orchestrator-settled (technical seams, follow ratified decisions): OQ-1 PlanState, OQ-6 AC #3 scope, OQ-7 stop at first refused command, OQ-9 spell range ponytail to TASK-0227, OQ-10 FactRow naming, OQ-11 keep the AI-hostile reaction port. Operator rulings pending: OQ-2/OQ-3 (action economy + Dodge card), OQ-4 (player-written DC), OQ-5 (stakes/free retry), OQ-8 (AI-DM fiat code), OQ-12 (unarmed strikes).

From TASK-0274: stand mapping and its golden test moved here; close-combat disadvantage is the engine's, the planner reports it as a fact.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-6)
Phases 8db77eaa, ceb0981c, 179ee146, eeaad658, 07627848; wiki 9c2209b9, 44e5e00a. 28 kinds plan to engine commands; attempt and use_object ask for a ruling; the rest refuse KIND_UNSERVED citing their owner card. 132 planner tests. ci:check exit 0 (DB suites skipped; the planner has no DB code). Orchestrator re-ran planner tests (132), boundary (28/28), freshness (OK 63), Dockerfile guard. The stand-mapping AC moved to TASK-0274: the engine stand command lands there, after this card merges. Until then stand refuses KIND_UNSERVED citing TASK-0274.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Package skeleton, types, boundary and kind table (AC #1): 11/11 · Checks and the ruling loop (US2, AC #2): 4/4 · Combat actions (US1, AC #2): 2/2 · Movement, turn, resources and DM control (US1, US3, AC #2): 5/5 · Legality, coverage and determinism (US3, AC #2, AC #3): 3/3 · Wiki re-ground: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
