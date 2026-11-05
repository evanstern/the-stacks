---
id: TASK-0237
title: >-
  The Director reveals an NPC before the dice, so a failed check still delivers
  the success outcome
status: In Progress
assignee: []
created_date: '2026-11-05 03:53'
updated_date: '2026-11-05 05:13'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a reveal that depends on a check happens only when the check's band allows it. The Director does not pre-decide an outcome the dice decide.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 43-51). Kestrel: 'I look and listen across the reeds for anything moving.' The Director ran before the dice, set arrivals [pell] and wrote the goal note 'Reward the scan with one true thing: Pell alive at the post'. Interpret declared the check's success outcome as 'She spots Pell alive…' and its failure outcome as 'The reeds and dusk give up nothing clear'. Kestrel rolled 3+3 = 6 vs DC 15, severe failure. The narration delivered the severe outcome (the lookout turns) AND revealed Pell: 'Yet the reeds give one mercy first … Pell, alive', and seq 46 set Pell present. The audit passed it (no ledger-mismatch). Spec 078 (TASK-0206) put arrivals on the Director, which runs before resolve; spec 070/080 (TASK-0127, 0170) fix outcomes before the roll. The two collide when a reveal is the check's stake.

Related: TASK-0206 (arrivals), TASK-0170 (declared outcome), TASK-0221 (lexical delivery check revisit), TASK-0113 (Director must not decide what the dice decide).

Spec: specs/089-reveal-waits-for-dice
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When a check's declared outcome names a reveal, the reveal (arrivals or prose) happens only on a band whose outcome includes it, with a test replaying seq 43-51
- [ ] #2 The Director's goal note does not promise a result the turn's dice will decide (prompt rule plus test), or arrivals that depend on a check wait for resolve
- [ ] #3 The audit flags prose that delivers a success outcome on a failure band (ledger-mismatch), with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 again (seq 63-72): the goal note promised the leader clue before Kestrel's Perception (severe failure, 9 vs DC 15). This time the audit caught it on attempt 2 (ledger-mismatch, actor Kestrel) and the fallback told the severe outcome. So the audit backstop works sometimes; the Director pre-deciding the outcome is the source.

Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0237, branch task-0237-reveal-waits-for-dice, cut from origin/main 8128fb3a. Spec number 089 claimed with a stub.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
