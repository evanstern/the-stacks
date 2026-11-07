---
id: TASK-0218
title: Offer a party member's opportunity attack to its player
status: To Do
assignee: []
created_date: '2026-11-03 03:18'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - engine
  - rules
  - replan-2026-11
milestone: m-3
dependencies:
  - TASK-0208
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a hostile leaves a party member's reach and the party member's reaction is unspent, the player is offered the opportunity attack and decides. AI companions decide by their own rule.

Why: spec 079 (TASK-0208) OQ-3 took default (a): the engine takes NPC reactions automatically but never takes one for a party member, since a reaction is the player's choice (TASK-0113 agency rule).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A hostile leaving a party member's reach offers that player a reaction prompt; accepting rolls the engine's reaction attack, declining spends nothing, with a test
- [ ] #2 An AI companion's reaction follows a stated rule, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0276 by replan-2026-11. OA offer is the reaction row.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
