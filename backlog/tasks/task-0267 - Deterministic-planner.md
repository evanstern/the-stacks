---
id: TASK-0267
title: Deterministic planner
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 15:35'
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
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: AC #4 (resolve.ts loses ported paths) moved to TASK-0269. This task ships the pure package with golden tests only.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0267, branch task-0267-planner, cut from origin/main d639c0e1. Spec number 097 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
