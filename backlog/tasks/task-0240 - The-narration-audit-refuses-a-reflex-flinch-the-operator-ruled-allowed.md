---
id: TASK-0240
title: The narration audit refuses a reflex flinch the operator ruled allowed
status: In Progress
assignee: []
created_date: '2026-11-05 04:00'
updated_date: '2026-11-05 05:13'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the model audit treats a reflexive flinch on a foe's miss as allowed, per the operator's ruling on spec 074 OQ-1 ("Yes, allow a flinch"), and blocks only a chosen dodge or a timed twist.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 100-106). Goblin-by-the-fire missed Odo. Attempt 2's 'Odo flinches at the near-miss' was refused as player-agency (blocking): 'Odo's flinch is shown as his choice, not as a reflex. The facts permit a reflex flinch…'. The audit model contradicted the facts it was given. The turn shipped the fallback after 3 attempts. TASK-0113's deterministic check passes a plain flinch (REFLEX_VERBS); the model audit criterion does not.

Related: TASK-0113 (spec 074), TASK-0214 (audit pass rate).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The audit prompt states that a listed reflex (including a flinch on a foe's miss) is never player-agency, and a test replays seq 100-106 attempt 2 with the scripted audit expecting pass
- [ ] #2 A player-agency issue whose detail names only a listed reflex is downgraded to advisory in code, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0240, branch task-0240-reflex-flinch-audit, cut from origin/main 8128fb3a. No spec dir: signed escape line E2 covers this task.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
