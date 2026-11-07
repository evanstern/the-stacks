---
id: TASK-0253
title: >-
  A fight can't resume once its encounter has ended: a broken truce gets no turn
  order
status: To Do
assignee: []
created_date: '2026-11-07 03:07'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
priority: high
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when hostilities resume in a scene whose seed encounter already ran (a truce broken, a fled foe returning), the table goes back to turn order with the foes still present, rolling fresh initiative.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc, seq 193-231). Odo's toll ended the reed-camp encounter (seq 193). Tamsin then declared 'I attack Snag again!' (seq 197): it resolved in free mode (hit, Snag wounded) and no encounter started — the table stayed in free mode for every beat after. Cause: nodes/director.ts runnableEncounterIds offers only seed encounters that have not run (spec 088 made 'startable until it has run' the rule), so the Director's switch to turn mode is overridden ('the encounter is not a seed encounter that has yet to run') and there is no other encounter to start. In free mode the AI companion then acted every beat on its own authority (see TASK-0244 notes).

Related: TASK-0238 (spec 088 runnable rule), TASK-0194 (pull-in), TASK-0210 (attack anyone), TASK-0165 (human DM ends an encounter).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After an encounter ends, an attack on a present foe (or the Director's turn decision) restarts turn order over the foes still present and conscious, with fresh initiative, with a test replaying seq 193-205
- [ ] #2 The restarted fight records as a new encounter run, so spec 088's has-run rule still blocks re-running the seed's opening setup
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
