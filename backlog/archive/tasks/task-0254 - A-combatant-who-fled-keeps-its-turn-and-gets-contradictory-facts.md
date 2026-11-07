---
id: TASK-0254
title: A combatant who fled keeps its turn and gets contradictory facts
status: To Do
assignee: []
created_date: '2026-11-07 03:09'
updated_date: '2026-11-07 05:19'
labels:
  - dm
  - rules
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
priority: medium
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a combatant whose scene presence is absent (fled) is skipped in the turn order or removed from the encounter, so its turn is never narrated from facts that say it both acts and does nothing.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc). The goblin lookout fled at seq 40 (scene-presence absent, reason fled) yet held a place in the reed-camp order. On its turn (seq 161-164) the facts read 'no rules effect (nothing rolled; Goblin lookout still acts in the story)' beside a planned dagger throw at Odo. All three narrations were refused (invented-mechanics, ledger-mismatch); the fallback shipped 'Goblin lookout holds back, watching.' 69.4 s turn.

Related: TASK-0238 (spec 088 arrivals), TASK-0206 (presence), TASK-0253 (encounter restart).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An absent combatant's turn is skipped (turn.advanced skipped list) or the combatant leaves the encounter, with a test replaying seq 40 and 161-164
- [ ] #2 No NPC turn's facts state both a planned action and no rules effect, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0274 by replan-2026-11. Fled combatant leaves the order.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
