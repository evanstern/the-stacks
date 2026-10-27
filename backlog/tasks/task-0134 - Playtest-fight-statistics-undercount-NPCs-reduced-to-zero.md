---
id: TASK-0134
title: Playtest fight statistics undercount NPCs reduced to zero
status: To Do
assignee: []
created_date: '2026-10-27 03:22'
labels:
  - playtest
  - harness
  - bug
milestone: m-3
dependencies: []
priority: low
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the playtest report's fight statistics count every combatant reduced to 0 HP, heroes and NPCs alike. Evidence: M2 demo (docs/design/m2-demo/demo-session/report.md, Fight statistics) reports 'Reduced to zero: none', but transcript.md shows 'goblin-3 takes 7 (7→0 HP)'. TASK-0055 rested its ruling on these statistics (operator ruling 2026-10-26, option A); the M3 demo (TASK-0053) will rely on them too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The fight-statistics fold counts NPCs reduced to 0 HP
- [ ] #2 A test replays a ledger with an NPC dropped to 0 HP and asserts the count
- [ ] #3 The M2 demo session's recomputed statistics report goblin-3 reduced to zero
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
