---
id: TASK-0143
title: 'Actor-state gate: Output claim gate: actor-aware checks over shipped narration'
status: In Progress
assignee: []
created_date: '2026-10-27 03:54'
updated_date: '2026-10-27 19:42'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
  - TASK-0142
priority: high
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a deterministic checker keyed to snapshot aliases refuses shipped text that contradicts actor state.

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U3). Dependencies as stated there: U1, U2, U8.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.

Spec: specs/051-output-claim-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The checker refuses a dead, downed or absent actor shown acting or speaking, with tests over M2 seq 225 and run 192319Z row 162.
- [ ] #2 It refuses a death or drop named on the wrong actor.
- [ ] #3 It refuses a count or quantifier that disagrees with the snapshot ("two down", "no goblins left"), with a test over M2 seq 225 and F52.
- [ ] #4 It runs on narrate prose and on the ruling and `goalNote` text that reach narrate.
- [ ] #5 A refusal feeds the existing regenerate loop and code fallback.
- [ ] #6 The actor-anonymous word checks in `audit-words.ts` are replaced or keyed to actors.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0143, branch task-0143-output-claim-gate, cut from origin/main 8d24c60. Spec number 051 claimed with a stub. Track C. Depends on TASK-0142 (PR #75, open): spec now, plan after #75 merges.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
