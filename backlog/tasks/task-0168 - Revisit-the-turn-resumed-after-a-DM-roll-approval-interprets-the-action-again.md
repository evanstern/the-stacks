---
id: TASK-0168
title: 'With a human DM, approving a check roll re-proposes the same roll'
status: In Progress
assignee: []
created_date: '2026-10-28 08:50'
updated_date: '2026-10-28 19:17'
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
- [x] #5 Spec phase: DB test, scripts and mutation guard (card AC #1)
- [x] #6 Spec phase: Live check in script mode (card AC #1)
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

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 (ef5ca417): second dm.interpret removed from human-dm-approval and greyhollow-human-dm (11 -> 10 calls); new human-dm-roll-chain script; new human-dm-roll-resume.integration.test.ts. Orchestrator-run T016: the new test 3/3 ((a) the approval turn calls exactly director, narrate, audit, one check.roll, action resolved applied; (b) a manual turn while the roll is pending is empty-beat; (c) roll, then effect, then one narration), plus five neighbouring DB suites, 25/25. T017 mutation: both resume functions stubbed, all 3 cases fail ((a)/(b) job failed on the spent script, (c) interpret called again); restored, diff empty.

spec-bridge sync: The resume classifier and the prior-turn read (card AC #2): 5/5 · The pipeline reuses the plan (card AC #1, card AC #2): 7/7 · DB test, scripts and mutation guard (card AC #1): 5/5 · Live check in script mode (card AC #1): 0/2 · Re-ground and close (all ACs): 0/4

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 (3d05faa1): evidence/live-resume.mjs for Brave (node --check passes), quickstart step 4 corrected. T019 blocked 2026-10-28: the auto-mode classifier denied the orchestrator's append of DM_FAKE_SCRIPT=greyhollow-human-dm to the worktree .env (quickstart step 2). Not worked around; put to the operator.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 (e2bd2bf2): dm-runtime, dm-turn-jobs, runtime-stacks re-verified and re-pinned; dm-failure-and-gates, debug-view, presence, seed-npc-presence, turn-floor re-pinned after grep found no affected claims; INDEX, CAPSULES, runbook amendment and TASK-0168 rows. Freshness OK (55), spec-bridge ok. T019 first attempt, 2026-10-28: the operator appended DM_FAKE_SCRIPT=greyhollow-human-dm to the worktree .env himself in chat; after an image rebuild the boot log read 10 calls. live-resume.mjs hung after the scene-start turn (an unbounded Playwright click; the step-6 flow skipped 055's Change scene step) and was killed. The stack was reset to fresh volumes; a fix is dispatched.

Correction to the note above: the operator ran the .env append themselves; "himself" was wrong.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 fixes: bb120cd6 (055 scene flow, bounded waits), 6121ed4c (roll cards counted by kind; run 2's one FAIL was the selector matching the dice line quoted in the narration card). T019 run 3 on a fresh stack at 6121ed4c: ALL CHECKS PASSED. Commit turn director+interpret paused on one check.roll; the approval turn after the roll called exactly director, narrate, audit; narration and dice line on both tables; next approval turn empty-beat; action.resolved seq 56 outcome applied; one check.roll proposal. Recorded in evidence/live-run.md with 6 Brave shots (f1a7367d). live-run.md counts 8 turn calls: the script's other 2 calls are dm.chronicle, spent by the two chronicle jobs, whose rows list no calls in the turns view.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
