---
id: TASK-0274
title: Encounter state machine
status: In Progress
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-10 03:13'
labels:
  - 'ws:engine'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0270
ordinal: 258000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the encounter a live engine state: start, join, leave, flee, end and resume. Absorbs TASK-0253, 0254.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-09).

Spec: specs/099-encounter-state
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fight ended by truce resumes with a fresh turn order when broken.
- [ ] #2 A fled combatant leaves the order and its zone.
- [ ] #3 Joining mid-fight rolls initiative for the newcomer only.
- [ ] #4 The planner applies disadvantage to a ranged attack made while a hostile is in the attacker's zone (spec 094 OQ-3; the engine knows no sides).
- [ ] #5 Standing from prone costs half the actor's speed, with an engine test (spec 094 OQ-4).
- [ ] #6 Phase 1: Engine sides and selectors (US5 engine half, foundation for US2–US4) (specs/099-encounter-state tasks.md)
- [ ] #7 Phase 2: Engine depart and stand (US2 engine half, US6, AC #5) (specs/099-encounter-state tasks.md)
- [ ] #8 Phase 3: Presence mapping in the gate (US2, US3 gate half) (specs/099-encounter-state tasks.md)
- [ ] #9 Phase 4: Server sides, phases and resume (US1, US2 server half, AC #1) (specs/099-encounter-state tasks.md)
- [ ] #10 Phase 5: Code-owned end and mid-fight arrivals (US3, US4, AC #3) (specs/099-encounter-state tasks.md)
- [ ] #11 Phase 6: Planner rules (US5, US6 mapping, AC #4) (specs/099-encounter-state tasks.md)
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0253 (A fight can't resume once its encounter has ended: a broken truce gets no turn order) by replan-2026-11: Encounter resume.

Merged from TASK-0254 (A combatant who fled keeps its turn and gets contradictory facts) by replan-2026-11: Fled combatant leaves the order.

Operator ruling 2026-11-08 (spec 094 OQs): OQ-3 and OQ-4 from spec 094 homed here as AC.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0274, branch task-0274-encounter-state, cut from origin/main d639c0e1. Spec number 099 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 099 (58fc1fd4): server-derived encounter phase, combatant sides, combatant.depart, stand (half speed), code-owned end, resume, closeCombatFoes for the planner. 7 phases; Phase 6 waits for TASK-0267. OQ-6 (a party wipe does not auto-end) kept as recommended. Operator rulings pending: OQ-1 (move the close-combat disadvantage rule into the engine instead of the planner), OQ-2/OQ-3/OQ-5 revisit cards, OQ-4 seed sides deferred to TASK-0056.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
