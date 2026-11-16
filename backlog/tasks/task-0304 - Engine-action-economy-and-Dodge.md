---
id: TASK-0304
title: Engine action economy and Dodge
status: Done
assignee: []
created_date: 2026-11-10 03:11
updated_date: '2026-11-16T02:13:00Z'
labels:
  - ws:engine
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0274
priority: high
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The engine tracks reactions and movement but not Action or Bonus Action use, so the planner cannot raise NO_ACTION_LEFT or NO_BONUS_ACTION_LEFT, the combat-turn UX cannot drain pips (TASK-0275 AC #1), and Dodge has no state to set. Source: spec 097 OQ-2 and OQ-3, Operator ruling 2026-11-09 (R1 lane specs 097-100). Parent epic: TASK-0258. Must merge before TASK-0275.

Spec: specs/117-action-economy-dodge
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The engine records Action and Bonus Action use per combatant per turn and resets them at turn start, with engine tests.
- [x] #2 The planner refuses a second Action or Bonus Action with NO_ACTION_LEFT or NO_BONUS_ACTION_LEFT.
- [x] #3 Dodge sets a dodging state until the actor's next turn: attacks against it have disadvantage and its Dex saves have advantage, with golden-dice tests.
- [x] #4 The dodge Intent plans to the engine command instead of refusing KIND_UNSERVED.
- [ ] #5 Spec phase: Engine economy, Dodge and casting time (FR-001–FR-013; AC #1, #3)
- [ ] #6 Spec phase: Planner economy, Dodge and the hosted replay (FR-014–FR-024; AC #2, #4)
- [ ] #7 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Hosted observation of the known gap, 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 5): two /attack Intents settled in one Tamsin turn (session 8c7d506e, seq 80 and 85, both outcome settled with batch rows). A level-1 fighter has no Extra Attack; AC #2 (NO_ACTION_LEFT) would have refused the second.

Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0304, branch task-0304-action-economy, cut from origin/main b7102dc0. Spec number 117 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5

Blocked 2026-11-15: the haiku tick of tasks.md T009-T018 (work done in 663f4e19) was refused by the auto-mode classifier (sed -i) and by a PreToolUse path-redirect hook (Edit). Not re-routed; waiting on the operator.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5

Tick unblocked 2026-11-15 after the operator's retry (cf5e6c03, sed, outside auto mode). Gates before PR: ci:check green (phase 3 run), wiki plan empty, freshness OK 66/66, boundaries 28/28.

ACs #1-#4 proven on the branch: engine economy.test.ts (SC-001/SC-002 golden dice), planner economy.test.ts and refusals.test.ts (SC-003/SC-004), dodge served (kinds.test.ts), hosted double-attack replays gate-intents.test.ts and gate.intent.integration.test.ts (NO_ACTION_LEFT, no rows). Spec-bridge sync to Done runs after merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine economy, Dodge and casting time (FR-001–FR-013; AC #1, #3): 8/8 · Planner economy, Dodge and the hosted replay (FR-014–FR-024; AC #2, #4): 11/11 · Wiki: 9/9). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
