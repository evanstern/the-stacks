---
id: TASK-0168
title: 'With a human DM, approving a check roll re-proposes the same roll'
status: In Progress
assignee: []
created_date: '2026-10-28 08:50'
updated_date: '2026-10-28 18:42'
labels:
  - dm-runtime
  - gate
milestone: m-3
dependencies: []
priority: high
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with a human DM seated, a player check narrates after the DM approves its roll. Evidence: the TASK-0159 live check (spec 055, 5614968, session 6cb00938) on a script-mode stack. The commit turn ran director and interpret and paused on a check.roll proposal (policy ask). The DM approved it: dice.rolled, check.resolved, proposal.approved. The resumed approval turn ran director and interpret again and wrote a second check.roll proposal for the same perception DC 13 (seq 56) instead of narrating. Each approval repeats this, so the check never narrates. An AI DM resolves the roll inside one turn, so only a human DM hits this. Why it matters: the TASK-0053 demo second run is ask mode with a human DM (checkpoint C7). Promoted from a revisit on 2026-10-28, once the loop reproduced.

Spec: specs/057-human-dm-roll-resume
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a human DM seated, a player check whose roll the DM approves narrates in the resumed turn, with no second roll proposal, and a DB test
- [ ] #2 The resumed turn reuses the resolved check rather than interpreting the action again, or a spec records why it must re-interpret
- [x] #3 Spec phase: The resume classifier and the prior-turn read (card AC #2)
- [x] #4 Spec phase: The pipeline reuses the plan (card AC #1, card AC #2)
- [ ] #5 Spec phase: DB test, scripts and mutation guard (card AC #1)
- [ ] #6 Spec phase: Live check in script mode (card AC #1)
- [ ] #7 Spec phase: Re-ground and close (all ACs)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0168, branch task-0168-human-dm-roll-resume, cut from origin/main 934d8d78. Spec 057 authored at 1b61d85 (056 is TASK-0154's). Root cause: the approval turn is a new job with an empty checkpoint, so assemble reselects the committed action and interpret re-proposes the same check; resolve keys submissions per job. Chosen (AC #2): reuse the resolved check. Open questions OQ-1 to OQ-4 go to the operator.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling, 2026-10-28, in the M3 sweep chat, verbatim: "TASK-0168: I accept the recommended defaults OQ-1 to OQ-4 (A): reuse the resolved check and amend 031, keep the Director in resumed turns, a rejected roll re-interprets as today, and awaiting actions leave every turn's beat."

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 1 (e8620cec): resume.ts (awaitingActionIds, needsPriorTurns, findResumedPlans, refreshSubmission), red on the missing module then 16/16; TurnCheckpoint.resumed, loadPriorTurnCheckpoints, NodeDeps.loadPriorTurns, worker wiring; 031 resolve.md and nodes.md Amended-by lines; OQ rulings in spec.md. No-DB server run: only the known TASK-0138 adjudicate failures.

spec-bridge sync: The resume classifier and the prior-turn read (card AC #2): 5/5 · The pipeline reuses the plan (card AC #1, card AC #2): 0/7 · DB test, scripts and mutation guard (card AC #1): 0/5 · Live check in script mode (card AC #1): 0/2 · Re-ground and close (all ACs): 0/4

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (99be423c): assemble drops awaiting actions and fills resumed; runner freezes resumed and skips adjudicate for resumed readings; interpret asks only about fresh items (no call when all resumed); adjudicate carries resumed rulings; resolve seeds refreshed submissions. 8 new unit cases red first, then 66/66 green. Orchestrator accepts the implementer's call that a frozen beat with null resumed reads as [] and does not search again (contract: a later attempt does not search again). resolve seeding is first exercised by the Phase 3 DB test.

spec-bridge sync: The resume classifier and the prior-turn read (card AC #2): 5/5 · The pipeline reuses the plan (card AC #1, card AC #2): 7/7 · DB test, scripts and mutation guard (card AC #1): 0/5 · Live check in script mode (card AC #1): 0/2 · Re-ground and close (all ACs): 0/4
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
