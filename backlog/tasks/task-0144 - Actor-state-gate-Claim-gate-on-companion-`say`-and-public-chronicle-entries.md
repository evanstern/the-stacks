---
id: TASK-0144
title: 'Actor-state gate: Claim gate on companion `say` and public chronicle entries'
status: To Do
assignee: []
created_date: '2026-10-27 03:54'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0143
  - TASK-0109
priority: medium
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the two model outputs that ship with no state check pass the U3 checker.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U4). Dependencies as stated there: U3; TASK-0109 (same chronicle footprint, merge after it).. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Companion `say` passes the claim gate before `gate.submit`; a refusal drops or regenerates it, with a test.
- [ ] #2 Public chronicle entries pass the claim gate against the snapshot at `throughSeq`, with a test.
- [ ] #3 DM-only chronicle entries are not gated and say so in the contract.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
