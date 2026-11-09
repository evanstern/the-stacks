---
id: TASK-0302
title: >-
  Interpret writes the player's user id as attackerId, so a legal attack on the
  player's own turn is refused
status: Done
assignee: []
created_date: '2026-11-09 05:23'
updated_date: '2026-11-09 13:43'
labels:
  - playtest
  - 'ws:intent'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0269
references:
  - docs/playtests/2026-11-09-r1-baseline-playtest.md
priority: high
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the R1 baseline playtest (2026-11-09, session 3406d9ae, seq 117-124). On Tamsin's own turn, 'I shoot the wounded goblin lookout on the rise' was refused STEP_ACTOR_MISMATCH and the turn was spent. The dm.interpret reading set the attack step's attackerId to the player's user id (6ff0a0f1-...) instead of the character id 'tamsin'. The plan gate's foreignActor check then saw a non-party attacker. The narration audit failed twice and shipped the fallback line 'Tamsin Vale cannot do that here.'

The structural fix is the Intent path: a typed attack Intent carries actor pc:tamsin from the seat, so no model writes an actor id (TASK-0267 planner, TASK-0269 interpret emits Intents). Until then the interpret prompt or a normalizer must map the seat's user id to its character.

Spec: specs/096-seat-actor-id
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A human player's attack on their own turn carries the character id as the attacker, with a regression test from session 3406d9ae seq 117.
- [ ] #2 No model output may set an actor id; the seat supplies it (fixed structurally by TASK-0269).
- [x] #3 Phase 1: prompts render the seated character id; seatActorIds normalizer; regression test (specs/096)
- [x] #4 Phase 2: wiki re-ground
- [x] #5 Spec phase: Seat labels and seat normalizer (US1, US2; FR-001 to FR-007)
- [x] #6 Spec phase: Wiki (re-ground)
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recurrence 2026-11-09: 4 of Tamsin's 5 combat actions refused STEP_ACTOR_MISMATCH (seq 118, 216, 271, 316); only one shot resolved (seq 164). Every refused turn spends her turn and ships a fallback narration. Combat stalls: the human PC cannot act. Severity: blocks combat for a human player on the solo seed.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0302, branch task-0302-seat-actor-id, cut from origin/main 48725992. Spec number 096 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 096 (652af7e0). Root cause verified by orchestrator: interpret and director call transcriptEntries(tail) without a roster, so speaker() in prompts/common.ts returns the raw user id for human lines; party-scope beat entries also fall back to the user id. Fix (c): label fix (prompt versions bumped) plus a seatActorIds normalizer after interpret, logged. AC #2 (seat supplies the actor) deferred to TASK-0269. OQ1 (companion prompt shows a commenter's user id) left to TASK-0299.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-2)
Phase 1 (b1f7300b): seated character id rendered in interpret (v16) and director (v11) prompts; seatActorIds normalizer logs dm.interpret.seat-actor. Phase 2 (d2190a08): 4 notes re-grounded. ci:check exit 0. Orchestrator re-ran seat-actor-id.test.ts (3/3) and freshness OK 62. AC #2 bypassed by spec 096: the structural fix is TASK-0269 (seat supplies the actor). Hosted verification after deploy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Seat labels and seat normalizer (US1, US2; FR-001 to FR-007): 6/6 · Wiki (re-ground): 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
