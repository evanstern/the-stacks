---
id: TASK-0238
title: An encounter monster can't be acted on before its encounter starts
status: To Do
assignee: []
created_date: '2026-11-05 03:56'
labels:
  - dm
  - playtest
  - presence
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a seed encounter's monsters (goblin-2/3/4 in reed-camp) can be targeted, opposed or talked to before the encounter starts, once the fiction puts them on screen: they become present actors the plan gate can resolve and pull in.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 52-60). The narration put 'the lookout by the fire' on screen (seq 51). Odo declared a parley with it. Interpret made a Persuasion check opposed by 'goblin-lookout' (influence rule, TASK-0128). The plan gate refused the whole action: UNKNOWN_COMBATANT, field difficulty.opposedBy, id goblin-lookout, reason not-in-snapshot. The seed's lookout is encounter monster goblin-3 ('Goblin lookout'); encounter monsters are not snapshot actors until the encounter starts, so there was no id interpret could name. The narration then voiced the parley's failure anyway (seq 60) though nothing resolved. TASK-0206 makes seed NPCs present on a reveal, and TASK-0210 pulls present non-combatants in, but neither covers encounter monsters.

Related: TASK-0206, TASK-0210, TASK-0128, TASK-0201 (objects as targets).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A revealed encounter monster is a snapshot actor interpret can name by its combatantId (or the gate maps a display name to it), with a test replaying seq 52-58
- [ ] #2 Acting on it before the encounter starts resolves (pull-in or encounter start per the Director), and the opposition check rolls, with a test
- [ ] #3 When the plan gate refuses an action, the narration does not voice the refused attempt's outcome as if it resolved, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
