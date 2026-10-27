---
id: TASK-0145
title: 'Actor-state gate: Director legality over actor state'
status: To Do
assignee: []
created_date: '2026-10-27 03:54'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
  - TASK-0142
  - TASK-0110
priority: medium
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: `legalizeDirector` reads the snapshot and refuses stage changes the state does not support.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U5). Dependencies as stated there: U1, U2, U8, TASK-0110.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Free mode and encounter end are refused unless every hostile actor is dead, unconscious, stable, `yielded` or `absent`, with a test over run 183818Z seq 260-265.
- [ ] #2 A tracker advance and a scene end must cite a recorded fact from the turn; one with no valid citation is refused, with tests.
- [ ] #3 The spotlight and companion prompts never name a downed or absent actor, with a test.
- [ ] #4 A refused Director move is logged and does not block the turn.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
