---
id: TASK-0141
title: 'Actor-state gate: Scene presence as tracked actor state, with a producer'
status: To Do
assignee: []
created_date: '2026-10-27 03:53'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
priority: high
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an actor's scene presence (`present`, `yielded`, `absent`) is a logged fact, and only a resolved step can change it.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U2). Dependencies as stated there: U1.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A catalogued event records a scene presence change with actor id, new value and reason (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`).
- [ ] #2 A step kind lets interpret and adjudicate propose a presence change; the gate applies it only through the engine, with tests.
- [ ] #3 An `absent` combatant leaves the encounter order through `combatant.remove`.
- [ ] #4 The snapshot reads scene presence from the log.
- [ ] #5 No Director field writes scene presence, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
