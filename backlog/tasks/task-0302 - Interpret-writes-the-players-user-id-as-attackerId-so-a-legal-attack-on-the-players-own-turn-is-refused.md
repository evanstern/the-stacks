---
id: TASK-0302
title: >-
  Interpret writes the player's user id as attackerId, so a legal attack on the
  player's own turn is refused
status: To Do
assignee: []
created_date: '2026-11-09 05:23'
updated_date: '2026-11-09 05:39'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A human player's attack on their own turn carries the character id as the attacker, with a regression test from session 3406d9ae seq 117.
- [ ] #2 No model output may set an actor id; the seat supplies it (fixed structurally by TASK-0269).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recurrence 2026-11-09: 4 of Tamsin's 5 combat actions refused STEP_ACTOR_MISMATCH (seq 118, 216, 271, 316); only one shot resolved (seq 164). Every refused turn spends her turn and ships a fallback narration. Combat stalls: the human PC cannot act. Severity: blocks combat for a human player on the solo seed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
