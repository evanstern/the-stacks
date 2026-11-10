---
id: TASK-0267
title: Deterministic planner
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-10 03:13'
labels:
  - 'ws:intent'
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
- [ ] #1 The planner makes no model call and no I/O (boundary lint).
- [ ] #2 Golden tests cover each supported kind, each refusal code and each ruling request.
- [ ] #3 Legality checks from TASK-0145 and TASK-0147 pass as planner tests.
- [ ] #4 Phase 1: Package skeleton, types, boundary and kind table (AC #1) (specs/097-planner tasks.md)
- [ ] #5 Phase 2: Checks and the ruling loop (US2, AC #2) (specs/097-planner tasks.md)
- [ ] #6 Phase 3: Combat actions (US1, AC #2) (specs/097-planner tasks.md)
- [ ] #7 Phase 4: Movement, turn, resources and DM control (US1, US3, AC #2) (specs/097-planner tasks.md)
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: AC #4 (resolve.ts loses ported paths) moved to TASK-0269. This task ships the pure package with golden tests only.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0267, branch task-0267-planner, cut from origin/main d639c0e1. Spec number 097 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 097 (a34d5d39): packages/planner, PlanState, 28 served kinds, PlanFact, RulingRequest, 6 phases. Orchestrator-settled (technical seams, follow ratified decisions): OQ-1 PlanState, OQ-6 AC #3 scope, OQ-7 stop at first refused command, OQ-9 spell range ponytail to TASK-0227, OQ-10 FactRow naming, OQ-11 keep the AI-hostile reaction port. Operator rulings pending: OQ-2/OQ-3 (action economy + Dodge card), OQ-4 (player-written DC), OQ-5 (stakes/free retry), OQ-8 (AI-DM fiat code), OQ-12 (unarmed strikes).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
