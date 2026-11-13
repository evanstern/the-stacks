---
id: TASK-0223
title: The roll step and effect amounts derive from the engine
status: In Progress
assignee: []
created_date: 2026-11-03 05:40
updated_date: '2026-11-13T02:06:00Z'
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
- [ ] #1 Roll steps and effect amounts carry no model-written number where an SRD record or stat defines one, with tests
- [ ] #2 An Unarmed Strike entry is derived for every combatant (1 + Strength modifier bludgeoning, SRD 5.2.1), so weapon 'unarmed' resolves (spec 097 OQ-12).
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
<!-- SECTION:NOTES:END -->
