---
id: TASK-0250
title: >-
  Runbook B2 playtest scenario: wounding hits, a held companion, a failed
  reveal, a pre-encounter monster, a flinch
status: In Progress
assignee: []
created_date: '2026-11-05 08:19'
updated_date: '2026-11-05 10:00'
labels:
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/design/m3-runbook-b2-playtest-fixes.md
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a TASK-0195-convention playtest scenario for runbook B2's fixes, rehearsed end to end on a worktree stack with DM_FAKE_SCRIPT, so the operator can play it (checkpoint C7).

Why: runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md) 'Last step', escape E3. Rows per that section: failed reveal check (0237), pre-encounter monster (0238), wounding hits (0242), companion in a party action (0244), flinch (0240), off-turn readying/perceptual verbs (0246), parse (0203, hosted), audit pass rate (0214, hosted), plus the standing rows (S-sneak-attack, S-spells-refused) and the revisit rows for TASK-0249 (088 OQ-2..4) and TASK-0248 (human PC out of turn, record only).

Related: TASK-0234 (runbook B scenario), TASK-0195.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Checklist docs/playtests/scenarios/runbook-b2-<name>.md has one row per runbook B2 'Last step' bullet plus the standing and revisit rows, in the checklist.mjs format
- [x] #2 Script apps/server/dm-scripts/runbook-b2-<name>.json sets up the scene for rehearsal only
- [x] #3 A local DM_FAKE_SCRIPT rehearsal log under docs/playtests/ shows the scenario runs end to end
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, spine #7). Worktree .worktrees/task-0250, branch task-0250-b2-scenario, cut from origin/main 430df14e. No spec dir: signed escape line E3 covers this task.

B2 scenario shipped: checklist runbook-b2-reed-camp.md (12 rows), script runbook-b2-reed-camp.json, rehearsal log 2026-11-05; code sha 1e040bb3
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
