---
id: TASK-0223
title: The roll step and effect amounts derive from the engine
status: In Progress
assignee: []
created_date: 2026-11-03 05:40
updated_date: '2026-11-13T02:42:00Z'
labels:
  - dm
  - engine
  - rules
  - ws:engine
milestone: m-10
dependencies:
  - TASK-0104
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 082 (TASK-0104) OQ-3: the free roll step and the Amount in effects (heal, damage) stay model-written dice. Derive them from SRD records or stats.

Spec: specs/109-engine-amounts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Roll steps and effect amounts carry no model-written number where an SRD record or stat defines one, with tests
- [x] #2 An Unarmed Strike entry is derived for every combatant (1 + Strength modifier bludgeoning, SRD 5.2.1), so weapon 'unarmed' resolves (spec 097 OQ-12).
- [x] #3 Spec phase: Engine Unarmed Strike (AC #2)
- [x] #4 Spec phase: AC #1 guard test
- [ ] #5 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): unarmed strikes derived here.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0223, branch task-0223-engine-amounts, cut from origin/main eff67463. Spec number 109 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 109 (fd588db1): 10 tasks in 3 phases; no C-CON, no C-GATE, no prompt bump. Orchestrator adopts the OQs from artifacts:
- OQ-1: band-effect amounts have no SRD record or stat, so they fall outside AC #1 by its wording; the AC moves to TASK-0313.
- OQ-2: derive in findAttack only; unarmed opportunity attacks carded as a revisit.
- OQ-3: floor at 0 with a ponytail.
- OQ-4: no item Intent kind exists yet.
- OQ-5: avoids a C-CON major change; the guard test covers it.
TASK-0312 seam: add the runSteps effect case and the presenceTargets Step-only loop to its deletion list.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-3 (a051ddc8, 9d32a9f3, 914304df). findAttack derives Unarmed Strike (toHit Str+PB, fixed max(0,1+Str) bludgeoning), with scripted-dice tests for hit, crit, 0 floor and missing Str. The planner plans 'unarmed'. The guard test fails on an added numeric ruling field or a number-carrying interpret kind (negative proof run twice, then reverted).
<!-- SECTION:NOTES:END -->
