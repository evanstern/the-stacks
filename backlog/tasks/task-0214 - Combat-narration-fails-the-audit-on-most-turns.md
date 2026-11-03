---
id: TASK-0214
title: Combat narration fails the audit on most turns
status: In Progress
assignee: []
created_date: '2026-11-02 23:22'
updated_date: '2026-11-03 11:23'
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
- [x] #3 Spec phase: Only the on-turn actor acts (US1; FR-001 to FR-004)
- [x] #4 Spec phase: Feelings, endings and the goal note (US2–US4; FR-005 to FR-010)
- [x] #5 Spec phase: Replay run 1 (US5; card AC #2, FR-011, FR-013)
- [ ] #6 Spec phase: Wiki re-ground
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0214, branch task-0214-combat-audit-pass-rate, cut from origin/main d59c369a. Spec number 085 claimed with a stub. Spine #19 (last).

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 085 authoring, C1; triage of run 1 refusals against merged upstream fixes)

spec-bridge sync: Only the on-turn actor acts (US1; FR-001 to FR-004): 0/10 · Feelings, endings and the goal note (US2–US4; FR-005 to FR-010): 0/8 · Replay run 1 (US5; card AC #2, FR-011, FR-013): 0/2 · Wiki re-ground: 0/6

Spec 085 (58a523af). Triage: seq 103 dice-lines FIXED (0213); 161 wrong subject FIXED (0208); 196 duplicate line FIXED (0212); PC/companion feelings FIXED (0113); next-actor-acts-in-this-beat OPEN (seq 103, 131, 196); NPC feelings, stock ending, goal-note counts PARTLY. Defaults (a) taken: OQ-1 rebuild run 1 rows from the log (no vm-104 command); OQ-2 no followUp-shown-done code check now, revisit card opened; OQ-3 companions count as party members (spec 074 OQ-3 default); OQ-4 keep the goal note in narrate, withhold one stating a count. Footprint: fallback.ts untouched; adds claims.ts, audit-words.ts, nodes/audit.ts, nodes/narrate.ts, prompts/director.ts. AC #1 ticks at the playtest.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 085 phases 1-2, with seam check)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 085 phases 3-4, plus the pre-audit block test skipped in phase 1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
