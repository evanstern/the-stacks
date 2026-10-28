---
id: TASK-0161
title: 'Actor-state gate: Check model-written roll reasons at the plan gate'
status: In Progress
assignee: []
created_date: '2026-10-27 19:52'
updated_date: '2026-10-28 20:03'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0143
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a roll reason the DM model writes cannot contradict actor state, because the plan gate checks it before resolve logs it.

Why: operator ruling 2026-10-27 on TASK-0143 OQ-1 (a): model-written roll reasons stay out of U3's output gate, and this follow-up card checks them at the plan gate. Resolve logs the reason on the dice line before narrate runs, and the log is append-only. Evidence: M2 seq 221, step reason "shouting that two kin have fallen", shipped on the seq 225 dice line while only one goblin had died. Use the TASK-0143 checker (spec 051).

Spec: specs/058-roll-reason-plan-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The plan gate runs the TASK-0143 actor-state checker on every model-written roll reason before resolve logs it.
- [ ] #2 A refused reason feeds the existing plan refusal path, with a test over M2 seq 221.
- [ ] #3 A reason the checker passes ships unchanged.
- [ ] #4 Spec phase: Evidence fixture and failing tests (card AC #2, #3 evidence)
- [ ] #5 Spec phase: The reason check in `checkPlan` (card AC #1, #2, #3)
- [ ] #6 Spec phase: Resolve wiring, the refusal code, DB tests, contracts (card AC #1, #2, #3)
- [ ] #7 Spec phase: DB suites and the mutation guard **[orchestrator]**
- [ ] #8 Spec phase: Wiki re-ground
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, verbatim: "0161 can be done in M3 if it fits well. If you think it should move to another milestone, I'll leave it to your judgement". Orchestrator ruling: keep in M3. It is the direct follow-up of TASK-0143 (an M3 sweep task), and a dice line that contradicts actor state would show in the TASK-0053 demo. It runs after TASK-0168, because both touch the roll path.

Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0161, branch task-0161-roll-reason-plan-gate, cut from origin/main b51f0b42. Spec 058 authored at bbcb1374: checkPlan runs the spec 051 checkClaims on every step reason and autoFail reason against S0 plus a presence-only planned diff; a refused reason refuses the group through the existing path; a resumed plan (spec 057) keeps its id check but does not rerun the reason check. Open questions OQ-1 to OQ-3 go to the operator.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
