---
id: TASK-0274
title: Encounter state machine
status: Done
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-10T21:31:00Z'
labels:
  - ws:engine
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
- [x] #1 A fight ended by truce resumes with a fresh turn order when broken.
- [x] #2 A fled combatant leaves the order and its zone.
- [x] #3 Joining mid-fight rolls initiative for the newcomer only.
- [x] #4 The planner applies disadvantage to a ranged attack made while a hostile is in the attacker's zone (spec 094 OQ-3; the engine knows no sides).
- [x] #5 Standing from prone costs half the actor's speed, with an engine test (spec 094 OQ-4).
- [x] #6 Phase 1: Engine sides and selectors (US5 engine half, foundation for US2–US4) (specs/099-encounter-state tasks.md)
- [x] #7 Phase 2: Engine depart and stand (US2 engine half, US6, AC #5) (specs/099-encounter-state tasks.md)
- [x] #8 Phase 3: Presence mapping in the gate (US2, US3 gate half) (specs/099-encounter-state tasks.md)
- [x] #9 Phase 4: Server sides, phases and resume (US1, US2 server half, AC #1) (specs/099-encounter-state tasks.md)
- [x] #10 Phase 5: Code-owned end and mid-fight arrivals (US3, US4, AC #3) (specs/099-encounter-state tasks.md)
- [x] #11 Phase 6: Planner rules (US5, US6 mapping, AC #4) (specs/099-encounter-state tasks.md)
- [x] #12 Phase 7: Wiki re-ground (specs/099-encounter-state tasks.md)
- [x] #13 After merging main (with the planner), the planner maps the stand Intent to the engine stand command and reports the engine's close-combat disadvantage as a fact, with golden tests (moved from TASK-0267).
- [x] #14 Spec phase: Engine sides and selectors (US5 engine half, foundation for US2–US4)
- [x] #15 Spec phase: Engine depart and stand (US2 engine half, US6, AC #5)
- [x] #16 Spec phase: Presence mapping in the gate (US2, US3 gate half)
- [x] #17 Spec phase: Server sides, phases and resume (US1, US2 server half, AC #1)
- [x] #18 Spec phase: Code-owned end and mid-fight arrivals (US3, US4, AC #3)
- [x] #19 Spec phase: Planner rules (US5, US6 mapping, AC #4) — REPLACED, not run
- [x] #20 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0253 (A fight can't resume once its encounter has ended: a broken truce gets no turn order) by replan-2026-11: Encounter resume.

Merged from TASK-0254 (A combatant who fled keeps its turn and gets contradictory facts) by replan-2026-11: Fled combatant leaves the order.

Operator ruling 2026-11-08 (spec 094 OQs): OQ-3 and OQ-4 from spec 094 homed here as AC.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0274, branch task-0274-encounter-state, cut from origin/main d639c0e1. Spec number 099 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 099 (58fc1fd4): server-derived encounter phase, combatant sides, combatant.depart, stand (half speed), code-owned end, resume, closeCombatFoes for the planner. 7 phases; Phase 6 waits for TASK-0267. OQ-6 (a party wipe does not auto-end) kept as recommended. Operator rulings pending: OQ-1 (move the close-combat disadvantage rule into the engine instead of the planner), OQ-2/OQ-3/OQ-5 revisit cards, OQ-4 seed sides deferred to TASK-0056.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-5, 7)
Phases b934a303, c57dc2e0, ac00de61, e1fcb426, 6ae46ed2, 4dd8d4b8. AC #4 met in the ENGINE per operator ruling 2026-11-09 (closeCombatSources in attack.roll and spell.cast; advantage cancels it); the planner reports it as a fact. AC #11 (Phase 6) superseded by that ruling; the stand mapping moves to TASK-0267. Engine 417, session-model 845, server 1917 pass (REQUIRE_DATABASE=1 on its stack, reported). ci:check exit 0. Orchestrator re-ran engine tests (417) and freshness (OK 63); env:down done. New wiki note dnd5e-engine-sides. PR held for spine order (#10).

Moved from TASK-0267: the planner's stand mapping and close-combat fact land here, when this branch merges main after TASK-0267.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (merge main + planner wiring)
Merged main 96c68c00 (wiki pin lines and CAPSULES only). c93d2da0: planner maps stand to the engine command; close-combat disadvantage reported as a rule fact when closeCombatSources is non-empty (attack, cast). Planner 135 pass; server with REQUIRE_DATABASE=1 on its stack 1966 pass / 5 skipped; ci:check exit 0; boundary 28/28. Orchestrator re-ran planner tests and freshness (OK 64). env:down and prune clean.

spec-bridge sync: Engine sides and selectors (US5 engine half, foundation for US2–US4): 7/7 · Engine depart and stand (US2 engine half, US6, AC #5): 6/6 · Presence mapping in the gate (US2, US3 gate half): 3/3 · Server sides, phases and resume (US1, US2 server half, AC #1): 8/8 · Code-owned end and mid-fight arrivals (US3, US4, AC #3): 5/5 · Planner rules (US5, US6 mapping, AC #4) — REPLACED, not run: 3/3 · Wiki re-ground: 8/8 — status In Progress → Done

Playtest 2026-11-10 (session 86abad65): the encounter ended in code at seq 195 after a negotiated trade; the table returned to free mode. R1 exit criterion 6 seen live.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine sides and selectors (US5 engine half, foundation for US2–US4): 7/7 · Engine depart and stand (US2 engine half, US6, AC #5): 6/6 · Presence mapping in the gate (US2, US3 gate half): 3/3 · Server sides, phases and resume (US1, US2 server half, AC #1): 8/8 · Code-owned end and mid-fight arrivals (US3, US4, AC #3): 5/5 · Planner rules (US5, US6 mapping, AC #4) — REPLACED, not run: 3/3 · Wiki re-ground: 8/8). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
