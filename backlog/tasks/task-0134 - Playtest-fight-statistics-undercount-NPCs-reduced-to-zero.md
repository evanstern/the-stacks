---
id: TASK-0134
title: Playtest fight statistics undercount NPCs reduced to zero
status: Done
assignee: []
created_date: '2026-10-27 03:22'
updated_date: '2026-10-27 04:59'
labels:
  - playtest
  - harness
  - bug
milestone: m-3
dependencies: []
priority: low
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the playtest report's fight statistics count every combatant reduced to 0 HP, heroes and NPCs alike. Evidence: M2 demo (docs/design/m2-demo/demo-session/report.md, Fight statistics) reports 'Reduced to zero: none', but transcript.md shows 'goblin-3 takes 7 (7→0 HP)'. TASK-0055 rested its ruling on these statistics (operator ruling 2026-10-26, option A); the M3 demo (TASK-0053) will rely on them too.

Spec: specs/042-fight-stats-npc-zero
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The fight-statistics fold counts NPCs reduced to 0 HP
- [x] #2 A test replays a ledger with an NPC dropped to 0 HP and asserts the count
- [x] #3 The M2 demo session's recomputed statistics report goblin-3 reduced to zero
- [x] #4 Spec phase: Fix the fold and prove it
- [x] #5 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0134, branch task-0134-fight-stats-npc-zero, cut from origin/main 1de90d3. Spec number 042 claimed with a stub. Track B7 (haiku implementation). Must merge before TASK-0053.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 042, commit 021b596.) Defect: stats.ts hp.changed counts reducedToZero only for side 'players'. ORCHESTRATOR RULING on OQ-1: the operator-signed docs/design/m2-demo.md stays unchanged; decision-0023 already records the evidence defect.

Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5
(Phases 1+2 grouped (small card), commits ada33ec d36ddaf; stats.test.ts 3/3; fails with the guard restored; M2 recompute = report.json with reducedToZero ['Goblin lookout']; ci:check exit 0.)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged in PR #64. The playtest fight statistics now count every combatant reduced to 0 HP: apps/server/src/playtest/auditor/stats.ts no longer limits reducedToZero to the players' side. stats.test.ts covers an NPC drop, a party drop, and a recompute of the committed M2 demo session (equal to report.json except reducedToZero = ['Goblin lookout']); the NPC and recompute cases fail with the guard restored. Signed M2 record unchanged (decision-0023 records the defect). Spec 042.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
