---
id: TASK-0222
title: Conditions that force an automatic save failure or an automatic critical hit
status: Done
assignee: []
created_date: 2026-11-03 05:40
updated_date: '2026-11-16T03:31:00Z'
labels:
  - dm
  - engine
  - rules
  - ws:engine
milestone: m-10
dependencies:
  - TASK-0104
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SRD 5.2.1 conditions that make saves fail automatically (paralyzed, stunned, unconscious on STR/DEX saves) or make hits within 5 ft critical apply through the engine. Spec 082 (TASK-0104) OQ-2 left them out.

Spec: specs/119-condition-auto-fail-crit
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The engine applies automatic save failure and automatic critical hits from conditions, with engine tests
- [x] #2 Spec phase: Engine rules, tests and contracts (FR-001–FR-017; AC #1)
- [x] #3 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0222, branch task-0222-condition-auto, cut from origin/main f076c127. Spec number 119 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

AC #1 proven on the branch: packages/dnd5e-engine/test/commands/condition-auto.test.ts (33 golden-dice tests, SC-001..SC-003) and the FR-017 replay in gate-intents.test.ts (typed /attack on a paralyzed goblin). Gates before PR: ci:check green, wiki plan empty, freshness OK 66/66, boundaries 28/28.

spec-bridge sync: Engine rules, tests and contracts (FR-001–FR-017; AC #1): 9/9 · Wiki: 5/5 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine rules, tests and contracts (FR-001–FR-017; AC #1): 9/9 · Wiki: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
