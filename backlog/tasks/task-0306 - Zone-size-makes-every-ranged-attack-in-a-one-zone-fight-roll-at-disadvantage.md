---
id: TASK-0306
title: Zone size makes every ranged attack in a one-zone fight roll at disadvantage
status: Done
assignee: []
created_date: '2026-11-10T04:45:00Z'
updated_date: '2026-11-10T15:34:00Z'
labels:
  - ws:space
  - replan-2026-11
  - ep-1
  - rules
milestone: m-10
dependencies: []
priority: medium
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while merging TASK-0271 with TASK-0274 (2026-11-09). Spec 100 gathers the party into the encounter zone at encounter start, and the reed-camp encounter is one zone (a 30-ft mud island). The close-combat rule (TASK-0274, operator ruling: engine applies ranged disadvantage when a hostile shares the attacker's zone) therefore gives every ranged attack in that fight disadvantage, for the whole fight. SRD 5.2.1 applies it only when a hostile is within 5 ft. Kestrel, an archer, is penalized on every shot. Evidence: two DB tests needed a second d20 (TASK-0271 commit c57d756b).

Options: (a) the rule needs the attacker 'engaged' (a hostile that has moved or attacked into melee with it, tracked per combatant) not merely sharing a zone; (b) split large encounter zones in seeds; (c) start ranged combatants at an edge zone. Needs an operator ruling before build.

Spec: specs/101-engaged-ranged
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An operator ruling picks the model for 'within 5 ft' in zone mode, recorded on this card.
- [x] #2 In the reed-camp fight, an archer not engaged in melee rolls a ranged attack without disadvantage, with a golden-dice test.
- [x] #3 An archer with a hostile engaged in melee with it still rolls at disadvantage.
- [x] #4 Phase 1: Engine melee pairs (US1, US2, US3) (specs/101-engaged-ranged tasks.md)
- [x] #5 Phase 2: Planner fact and server tests (US1 server half, FR-011, FR-013) (specs/101-engaged-ranged tasks.md)
- [x] #6 Phase 3: Wiki re-ground (specs/101-engaged-ranged tasks.md)
- [x] #7 Spec phase: Engine melee pairs (US1, US2, US3)
- [x] #8 Spec phase: Planner fact and server tests (US1 server half, FR-011, FR-013)
- [x] #9 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-10: engaged-only. Ranged (and ranged spell attack) disadvantage applies only while a hostile is ENGAGED with the attacker: a hostile that made a melee attack against it, or that it made a melee attack against, this round or since its last turn, while both share a zone. Sharing a zone alone no longer triggers it. This narrows the 2026-11-09 engine ruling (TASK-0274); the rule stays in the engine.

Correction: the operator's words were 'Engaged-only penalty' (option text: the penalty applies only when an enemy is actually engaged in melee with the attacker, tracked per combatant). The detailed trigger in the previous note (a melee attack between them this round or since the last turn) is the orchestrator's proposed definition, not the operator's. Spec 101 settles the definition; any judgment call there comes back as an open question.

Claimed 2026-11-09 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0306, branch task-0306-engaged-ranged, cut from origin/main 8b4772b9. Spec number 101 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 101 (02b96689): Encounter.melee pairs formed by a resolved melee attack roll between same-zone hostiles; a pair ends on a placement change, leaving the order, or encounter end; it does not count while the foe is down, incapacitated or blinded, or the attacker invisible. closeCombatFoes reads pairs; opportunity attacks keep same-zone. 3 phases. Operator rulings pending: OQ-1 (narrow opportunity attacks to pairs too?), OQ-2 (Disengage does not end a pair), OQ-3 (no penalty outside an encounter), OQ-4 (only an attack forms a pair, not moving in).

Operator rulings 2026-11-10 on spec 101: pair model approved; opportunity attacks keep same-zone (narrowing noted on TASK-0305); Disengage does not end a pair, but the move that usually follows does (operator note; golden test added to scope); no penalty outside an encounter.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-3)
c7000f9a engine melee pairs; 2707677c planner comment and DB tests back to one d20; b1d5d545 wiki. Disengage-then-move golden test passes (pair holds after Disengage, gone after the move, shot rolls normal). Server with REQUIRE_DATABASE=1: 1979 pass / 5 skipped. Orchestrator re-ran melee 16, engine 438, planner 136, freshness OK 65, and full ci:check (exit 0) after merging main.

spec-bridge sync: Engine melee pairs (US1, US2, US3): 9/9 · Planner fact and server tests (US1 server half, FR-011, FR-013): 4/4 · Wiki re-ground: 3/3 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine melee pairs (US1, US2, US3): 9/9 · Planner fact and server tests (US1 server half, FR-011, FR-013): 4/4 · Wiki re-ground: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
