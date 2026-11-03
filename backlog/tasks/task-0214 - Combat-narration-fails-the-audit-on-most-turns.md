---
id: TASK-0214
title: Combat narration fails the audit on most turns
status: In Progress
assignee: []
created_date: '2026-11-02 23:22'
updated_date: '2026-11-03 10:46'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: most narrations pass the audit on the first attempt, so turns are faster and players read authored prose, not the fallback.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, 23 narrations). The auditor reports 16 of 23 needed a regenerate (6) or shipped the fallback (10). The repeated issues are invented-mechanics (the narration shows the next actor or another NPC acting in this beat, or shows a followUp as done), player-agency (it decides a PC's, companion's or NPC's feelings or reactions), and doctrine (it ends on 'What do you do?', or offers an option menu). Combat turns took a median 40 s (max 73 s; 7 over 45 s), mostly regenerate loops. narrate-v7's Turn/Next rule (TASK-0193) is not holding.

Related: TASK-0193, TASK-0204 (question ending), TASK-0113 (player agency), TASK-0207 (talk fallback), TASK-0212.

Spec: specs/085-combat-audit-pass-rate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a hosted run of 15+ combat turns, at least 70% of narrations pass the audit on attempt 1
- [ ] #2 The narrate prompt or facts change is replay-tested against the run 1 refusals (seq 103, 126, 131, 161, 196)
- [ ] #3 Spec phase: Only the on-turn actor acts (US1; FR-001 to FR-004)
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0214, branch task-0214-combat-audit-pass-rate, cut from origin/main d59c369a. Spec number 085 claimed with a stub. Spine #19 (last).

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 085 authoring, C1; triage of run 1 refusals against merged upstream fixes)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
