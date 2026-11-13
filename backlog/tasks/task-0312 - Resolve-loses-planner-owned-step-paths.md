---
id: TASK-0312
title: Resolve loses planner-owned step paths
status: In Progress
assignee: []
created_date: '2026-11-11T19:50:00Z'
updated_date: '2026-11-13T03:24:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0269
  - TASK-0223
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-0269 by operator ruling 2026-11-11 (spec 104 size check). After TASK-0269 ships, interpret emits only Intents, so resolve's step paths run only for old resumed checkpoints and the free-retry/autoFail fallback. Delete the code the planner now owns. Spec 104 plan names the files (resolve.ts, plan-gate.ts, nodes/adjudicate.ts, prompts/adjudicate.ts, step-grammar.ts if unused, the encounter-start gathering block). Lands after TASK-0223 (spec 104 OQ-9).

Parent epic: TASK-0258.

Spec: specs/110-resolve-cleanup
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 resolve.ts loses the code paths the planner now owns (moved from TASK-0267 by F1, then from TASK-0269 by the split).
- [ ] #2 The encounter-start gathering in resolve.ts is removed once spatial placement owns it (spec 100 OQ-13).
- [ ] #3 An old-shape resumed plan is dropped and re-interpreted (spec 104 OQ-8).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 109 (TASK-0223): add to the deletion list two items spec 104 D8 omits: the runSteps 'effect' case, and the Step-only loop in presenceTargets.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0312, branch task-0312-resolve-cleanup, cut from origin/main e0d4ed33. Spec number 110 claimed with a stub.
<!-- SECTION:NOTES:END -->
