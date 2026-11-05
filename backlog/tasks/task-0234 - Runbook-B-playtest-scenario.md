---
id: TASK-0234
title: Runbook B playtest scenario
status: Done
assignee: []
created_date: '2026-11-03 10:47'
updated_date: '2026-11-05 04:42'
labels:
  - playtest
  - dm
milestone: m-3
dependencies:
  - TASK-0214
priority: high
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: runbook B ships a playtest scenario aimed at its fixes, under the TASK-0195 convention (docs/design/playtest-scenarios.md): a seed (reuse greyhollow-ford-reed-camp unless a row needs a new seed fact), a DM_FAKE_SCRIPT setup script, a checklist under docs/playtests/scenarios/, and a local rehearsal log under docs/playtests/.

Why: docs/design/m3-runbook-b-resolution-quality.md 'Last step'. The operator plays it after the sweep (checkpoint C7).

Rows (from the runbook): undeclared method (0205, 0113); clarify question (0209); revealed NPC (0206); attack on a captive (0210); opportunity attack (0208); spell slot (0211, 0105); stakes and outcome (0127, 0170); engine numbers (0104); opposition and Help (0128); scene start names the party characters and Wenna, and no player (0171); narration: no 'What do you do?' ending, 15+ combat turns for the audit pass rate, fallback voices NPC lines and dice lines (0204, 0214, 0207, 0212, 0213); open followUp stays undone (0208 AC #4); parse (0203); revisit rows TASK-0216, 0221, 0233; standing rows S-sneak-attack and S-spells-refused.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The checklist has one row per runbook B 'Last step' bullet plus the standing and revisit rows, in checklist.mjs format
- [x] #2 A DM_FAKE_SCRIPT rehearsal of the scenario runs end to end on a worktree stack, with its log under docs/playtests/
- [x] #3 The scenario's hosted-only rows (0203 AC #2, 0204 AC #2, 0214 AC #1) are named so the playtest can tick those cards
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0234, branch task-0234-runbook-b-scenario, cut from origin/main 08cdf8eb. No spec dir: signed escape line covers this task. Runbook B Last step. Under the TASK-0195 convention (card ACs drive, as TASK-0195's E3 did).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (scenario authoring and rehearsal)

Shipped 1c27ba7d: docs/playtests/scenarios/runbook-b-reed-camp.md (21 rows), apps/server/dm-scripts/runbook-b-reed-camp.json, docs/playtests/2026-11-03-runbook-b-scenario-rehearsal.md. Rehearsal ran end to end on the worktree stack with DM_FAKE_SCRIPT. Seed greyhollow-ford-reed-camp reused unchanged. Gates green. Follow-ups carded for the playtest-run skill (.claude/ is outside implementer scope).

Played 2026-11-03 (session 729a6c5c, hosted dev, 37 turns, $4.73 of the $100 ceiling): every B-row got a verdict; checklist 33 pass, 7 fail, 2 blocked, 2 not reached (rolled forward from runbook A). Log: docs/playtests/2026-11-03-runbook-b-playtest.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Runbook B's playtest scenario: a 21-row checklist aimed at every runbook B fix (plus hosted-only, revisit and standing rows), a rehearsal setup script, and a local rehearsal log. Ready for the operator to play (C7).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
