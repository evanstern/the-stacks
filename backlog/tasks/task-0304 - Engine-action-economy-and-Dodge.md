---
id: TASK-0304
title: Engine action economy and Dodge
status: To Do
assignee: []
created_date: '2026-11-10 03:11'
labels:
  - 'ws:engine'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0274
priority: high
ordinal: 288000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The engine tracks reactions and movement but not Action or Bonus Action use, so the planner cannot raise NO_ACTION_LEFT or NO_BONUS_ACTION_LEFT, the combat-turn UX cannot drain pips (TASK-0275 AC #1), and Dodge has no state to set. Source: spec 097 OQ-2 and OQ-3, Operator ruling 2026-11-09 (R1 lane specs 097-100). Parent epic: TASK-0258. Must merge before TASK-0275.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine records Action and Bonus Action use per combatant per turn and resets them at turn start, with engine tests.
- [ ] #2 The planner refuses a second Action or Bonus Action with NO_ACTION_LEFT or NO_BONUS_ACTION_LEFT.
- [ ] #3 Dodge sets a dodging state until the actor's next turn: attacks against it have disadvantage and its Dex saves have advantage, with golden-dice tests.
- [ ] #4 The dodge Intent plans to the engine command instead of refusing KIND_UNSERVED.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
