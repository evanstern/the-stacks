---
id: TASK-0146
title: 'Actor-state gate: `dm.audit` receives the actor snapshot'
status: To Do
assignee: []
created_date: '2026-10-27 03:54'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - rules-gate
  - replan-2026-11
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
priority: medium
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the model auditor judges prose against S1, not this turn's facts only.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U7). Dependencies as stated there: U1; U2 for criterion 2.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The audit prompt renders S1 and the diff, with a prompt test.
- [ ] #2 A regression over F52 (M2 seq 307) shows the auditor's verdict follows recorded scene presence.
- [ ] #3 Blocking derivation in code is unchanged.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: TASK-0272: audit shrinks to leak/contradiction over the fact sheet.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
