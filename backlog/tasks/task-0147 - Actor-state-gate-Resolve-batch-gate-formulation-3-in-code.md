---
id: TASK-0147
title: 'Actor-state gate: Resolve batch gate: formulation 3 in code'
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
  - TASK-0110
  - TASK-0127
  - TASK-0128
priority: medium
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the resolve batch is refused when a plot change lacks a recorded fact, or when a change to another actor lacks a roll against that actor or an engine-coded SRD rule.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U9). Dependencies as stated there: U1, U2, TASK-0110, TASK-0127, TASK-0128.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A change to another actor with no roll row naming that actor in the batch is refused, with a test over M2 seq 296-301.
- [ ] #2 An engine-coded SRD rule (0 HP to unconscious; a willing ally accepting a beneficial effect) passes with no roll, with tests.
- [ ] #3 An uncontested effort passes as a no-roll outcome row, with a test over M2 seq 304.
- [ ] #4 The gate compares effect target ids with the acting actor; it reads no prose.
- [ ] #5 A refused batch writes nothing and the action resolves `refused` with a refusal code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
