---
id: TASK-0354
title: Encounter never ends when the whole party is down
status: To Do
assignee: []
created_date: '2026-11-15T13:36:00Z'
labels:
  - bug
  - ws:engine
milestone: m-10
dependencies: []
priority: high
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 retest (2026-11-15, session 6031b671, vm-104 at 058f831c). By round 3 all three PCs were at 0 HP: Kestrel and Odo dead, Tamsin stable. The encounter did not end. The AI DM kept passing monster turns with an empty narrate call, about one every 6 s, for over an hour and through 500+ rounds, until an operator stopped the jobs in the DB (C9). Cost about $8 of the $15 ceiling. /pause returned DM_SEAT_REQUIRED, and no seat could take the DM, so the app offered no way to stop the loop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When no PC can act (all dead, dying, stable or unconscious), the encounter ends in code with a reason, and no further monster turns are queued.
- [ ] #2 A test replays the party-down state and asserts that encounter.ended lands and no turn job follows.
- [ ] #3 The operator can stop a runaway AI-DM session from the app without a DB write.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
