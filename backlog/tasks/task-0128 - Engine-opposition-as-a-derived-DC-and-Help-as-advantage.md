---
id: TASK-0128
title: 'Engine: opposition as a derived DC, and Help as advantage'
status: In Progress
assignee: []
created_date: '2026-10-27 02:32'
updated_date: '2026-11-03 09:53'
labels:
  - dm
  - engine
  - rules
milestone: m-3
dependencies:
  - TASK-0104
priority: medium
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: opposed efforts and assistance resolve by SRD 5.2.1 rules in the engine, not by model-chosen numbers. SRD 5.2.1 states opposition as a check against a DC derived from the opponent (for example the grapple escape DC, 8 + Strength modifier + proficiency bonus) and defines the Help action as advantage on an ally's next check. It has no group-check rule; group checks stay behind the table-rules flag from the stakes-before-dice card. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).

Spec: specs/084-opposition-and-help
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine derives an opposition DC from the opponent's stats for each SRD-defined case, with tests
- [ ] #2 A Help action grants advantage on the ally's next matching check and expires per SRD 5.2.1, with a test
- [ ] #3 Interpret emits opposition and help as step kinds, and a schema test covers both
- [ ] #4 Spec phase: Seam check [orchestrator]
- [ ] #5 Spec phase: Engine (card AC #1, #2; US1, US2)
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0128, branch task-0128-opposition-and-help, cut from origin/main 4cea63d8. Spec number 084 claimed with a stub. Spine #15; beside 0105 if disjoint.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 084 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
