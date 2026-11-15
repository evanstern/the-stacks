---
id: TASK-0357
title: Narration says monsters are dead when the ledger shows them alive
status: To Do
assignee: []
created_date: '2026-11-15T13:40:00Z'
labels:
  - bug
  - ws:narrate
milestone: m-10
dependencies: []
priority: medium
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 retest (2026-11-15, session 6031b671). life-states fails 31 times. At seq 266, 277 and 292, the prose says the pot-helm goblin, the lookout and the goblin by the fire are dead. The ledger records no such change. Later loop narrations say Snag is dead. Most fails come from the party-down loop (TASK-0354), and seq 266-292 is inside it. The runtime narrate check did not catch them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runtime narration check rejects or repairs prose that marks an alive combatant dead.
- [ ] #2 A replay of seq 266 from session 6031b671 passes life-states.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
