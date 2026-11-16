---
id: TASK-0215
title: Engine records surprise; facts derive startlement
status: In Progress
assignee: []
created_date: 2026-11-03 00:33
updated_date: '2026-11-16T06:35:00Z'
labels:
  - dm
  - engine
  - rules
  - ws:engine
milestone: m-10
dependencies:
  - TASK-0113
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the engine records surprise at encounter start (SRD 5.2.1), and NarrationFacts derives a startlement reflex from it, as TASK-0113's research finding (b) lists.

Why: spec 074 (TASK-0113) OQ-2. Startlement is one of the four operator-confirmed reflex triggers (2026-10-26), but the engine records no surprise, so no fact can be derived. Spec 074 derives none.

Spec: specs/121-engine-surprise
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The engine records which combatants are surprised when an encounter starts, with an engine test
- [x] #2 The fact sheet lists a startlement involuntary effect for a surprised PC, with a test (retargeted from NarrationFacts by F3).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F3: AC #2 retargeted from NarrationFacts to the TASK-0245 fact sheet. Lands after TASK-0274 and TASK-0245.

Claimed 2026-11-16 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0215, branch task-0215-surprise, cut from origin/main 0f0add89. Spec number 121 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

ACs proven on the branch: AC #1 encounter.test.ts 'spec 121: surprise' (golden dice) plus the gate-plan.test.ts replay; AC #2 facts.test.ts deriveStartle and the fact-sheet.test.ts run-5 replay (surprised PCs listed, goblin not). Gates before PR: ci:check green, wiki plan empty, freshness OK 66/66, boundaries 28/28. Prompts: dm.narrate-v27, dm.director-v13, dm.interpret-v19, playtest.audit-v3.
<!-- SECTION:NOTES:END -->
