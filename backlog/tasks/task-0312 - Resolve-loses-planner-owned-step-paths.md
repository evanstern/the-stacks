---
id: TASK-0312
title: Resolve loses planner-owned step paths
status: In Progress
assignee: []
created_date: '2026-11-11T19:50:00Z'
updated_date: '2026-11-13T04:02:00Z'
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
- [ ] #4 Spec phase: Throw-stub probe (no deletion)
- [ ] #5 Spec phase: Encounter-start gathering (AC #2)
- [ ] #6 Spec phase: Adjudicate node (C-GATE ruling required before dispatch)
- [ ] #7 Spec phase: Step paths in resolve and the plan gate (AC #1)
- [ ] #8 Spec phase: Schemas and old checkpoints (AC #3)
- [ ] #9 Spec phase: Wiki
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

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 110 (684d8e1a): 27 tasks, 6 phases, no split. Estimated deletions: about 1500 source lines and 2000-2500 test lines. Phase 1 is a throw-stub probe before any deletion. C-GATE before phase 3: the adjudicate seam in specs/031 node-seam.md and turn-jobs.md. AC #3 is a one-way door: old checkpoint readings are dropped and re-interpreted.

C-GATE ruling (operator, 2026-11-12, in chat): "Approve all". This approves deleting the adjudicate node, with Phase 3 amending specs/031-dm-runtime/contracts/node-seam.md and turn-jobs.md. It also approves the AC #3 one-way door (old checkpoint readings dropped and re-interpreted) and OQ-1..OQ-6 as recommended.
<!-- SECTION:NOTES:END -->
