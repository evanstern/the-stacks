---
id: TASK-0255
title: 'A kill''s narration does not name the death, so the turn falls back'
status: To Do
assignee: []
created_date: '2026-11-07 03:09'
updated_date: '2026-11-07 05:19'
labels:
  - dm
  - narration
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
priority: high
ordinal: 239000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a hit kills a foe, the first narration names the death, so the code check's ledger-mismatch does not burn attempts.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc, seq 130-139). Tamsin killed the goblin with a pot-helm (19 vs AC 15, 10 slashing, 10→0, seq 134 life-state dead). Attempts 1 and 2 were blocked by the code check 'Goblin with a pot-helm died this turn, and no sentence names it with a death word'; attempt 3 was blocked for Odo's stance (off turn). The fallback shipped 'Goblin with a pot-helm is wounded. Goblin with a pot-helm is dead.' Likely the narrate facts or rules do not state the death plainly enough for the model.

Related: TASK-0212 (fallback falls unconscious), TASK-0214 (pass rate), TASK-0252 (life state at the table).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A narrate fact line states a death in words ('X dies' / 'X is dead') and the narrate rule says to name it, with a test replaying seq 130-139
- [ ] #2 A replay of seq 130-139 passes the code check on attempt 1 with the scripted narration
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: 0245: the death is a code fact row.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
