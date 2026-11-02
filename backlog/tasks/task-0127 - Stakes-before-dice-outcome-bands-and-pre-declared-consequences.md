---
id: TASK-0127
title: 'Stakes before dice: outcome bands and pre-declared consequences'
status: In Progress
assignee: []
created_date: '2026-10-27 02:32'
updated_date: '2026-11-02 06:16'
labels:
  - dm
  - doctrine
  - engine
milestone: m-3
dependencies:
  - TASK-0113
priority: high
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every check's consequences are fixed before the engine rolls, and narration tells the outcome band it is handed instead of inventing a consequence afterwards. Why: fail-forward and trying-costs (doctrine P10, P11) are prompt-only today and run after the dice, which is where invented near-misses and dodges came from (TASK-0106 evidence seq 130, F6). Shape (D14 points 2, 3, 6): interpret declares the consequence per outcome band on each check step; code computes margin (total minus DC) and band; bands for ability checks are success, success at a cost (miss by 1-2), failure, severe failure (miss by 5 or more); attacks and saves stay SRD-binary. A check with no failure consequence resolves without a roll. A retry with no new risk succeeds without a roll. Table-rules settings (operator ruling 2026-10-26): outcome bands ON by default; natural 20 succeeds on any d20 test ON by default; group checks OFF by default. Extends the NarrationFacts shape TASK-0113 defines; spec as a doctrine and contract change. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).

Spec: specs/070-stakes-before-dice
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A check step carries a consequence for each outcome band before the roll, and a schema test rejects a check step with no failure consequence
- [ ] #2 Code computes margin and band from the engine's total and DC, and NarrationFacts carries the band
- [ ] #3 A table-rules setting holds each house-rule flag with its default, and a test covers each flag on and off
- [ ] #4 A natural 20 on a d20 test succeeds when its flag is on, with an engine test
- [ ] #5 A retry with no new risk resolves without a roll, with a test
- [ ] #6 The auditor checks that prose delivers the declared band, with a test over a captured run
- [ ] #7 A natural 1 on a d20 test fails when its flag is on, with an engine test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OPERATOR RULING 2026-10-26, in the operator's words: 'Yes, nat 20 = success nat 1 = failure'. Applies to every d20 test as a table-rules flag, default ON (SRD 5.2.1 reserves this for attack rolls only; this extends it to checks and saves).

Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0127, branch task-0127-stakes-before-dice, cut from origin/main 7e252840. Spec number 070 claimed with a stub. Side lane: spec only, built in runbook B.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Operator ruling 2026-11-02 (in chat, answering 'How should the remaining lanes get write access to .worktrees/?'): "Allow edits via Bash". The harness edit guard blocks Write/Edit outside the session worktree; dispatched agents edit worktree files through Bash (heredocs, sed, scripts) instead.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
