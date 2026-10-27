---
id: TASK-0127
title: 'Stakes before dice: outcome bands and pre-declared consequences'
status: To Do
assignee: []
created_date: '2026-10-27 02:32'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A check step carries a consequence for each outcome band before the roll, and a schema test rejects a check step with no failure consequence
- [ ] #2 Code computes margin and band from the engine's total and DC, and NarrationFacts carries the band
- [ ] #3 A table-rules setting holds each house-rule flag with its default, and a test covers each flag on and off
- [ ] #4 A natural 20 on a d20 test succeeds when its flag is on, with an engine test
- [ ] #5 A retry with no new risk resolves without a roll, with a test
- [ ] #6 The auditor checks that prose delivers the declared band, with a test over a captured run
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
