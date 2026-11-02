---
id: TASK-0193
title: >-
  NPC turns ship as bare fallback lines when the narrator writes ahead of the
  turn
status: In Progress
assignee: []
created_date: '2026-11-02 04:31'
updated_date: '2026-11-02 08:43'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: on an NPC's turn the player reads what the NPC actually did, not a code fallback like 'Snag makes a move. Kestrel moves next.'

Why: alpha run 3 (2026-11-02, seq 148-158). Twice the narration audit refused prose for describing an NPC acting before its turn had resolved ('invented-mechanics': the goblin by the fire acting; 'ledger-mismatch': Snag acting while the facts say it is Kestrel's turn). Each time the in-fiction fallback shipped instead: 'Odo offers Snag silver and peace ... Goblin by the fire moves next.' and 'Snag makes a move. Kestrel moves next.' The second line tells the players nothing about what Snag did; there was no mechanical action at all on that turn (no dice, no attack, no check), so it reads as a stall. Odo's line also printed the raw roll line twice.

Questions for the spec: should an NPC turn with no mechanical step still get a described action (talk, stance, movement) the narrator may write; should the narrator see the next actor so it stops narrating ahead; should the fallback name what was resolved.

Related: dm-narration-quality fallback (apps/server/src/dm/fallback.ts), TASK-0133 (roll line before prose), TASK-0170.

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)

Spec: specs/071-npc-turn-narration
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An NPC turn ships narration that states what that NPC did, or states that it held, in fiction
- [x] #2 The narrator prompt marks which actor's turn this is and forbids narrating the next actor's action
- [x] #3 A fake-gateway test replays run 3 seq 150-157 and ships a described Snag action, not the bare fallback
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Also from run 3 (finding 14): when the absence job passed Kestrel's turn (seq 161-163, purpose floor), the table shows only a floor line 'Tamsin's turn' after 'Snag makes a move. Kestrel moves next.', so players read it as a skipped turn. A floor pass should say why ('Kestrel is away; the turn passes').

Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0193, branch task-0193-npc-turn-narration, cut from origin/main 5b4d8bda. Spec number 071 claimed with a stub. Lane A1, after TASK-0192 (PR #102). Spec 071. Rides: spec 063 tasks.md superseded ticks so TASK-0181 can close.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 071 authoring, C1)
Orchestrator rulings 2026-11-02 on spec 071 (all inside the card's scope, no contract or vm-104 change): OQ-1 (a) rebuild the replay from the run 3 log and duo seed, no vm-104 read; OQ-2 (a) no interpret change (avoids lane A2's file); OQ-3 (a) not in this task, carded separately; OQ-4 (a) the floor-pass line stays here, as the card's finding-14 note folds it in. Overlap check vs spec 068: no shared source file (only the dm-runtime wiki note), so 0193 builds in parallel with 0194.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 071 phase 1, c8c93dea)
Rides this branch: re-pin of 4 wiki notes main left stale after PR #100 (TASK-0191, 4df70e2b): client-session-hook, m0-demo, play-route, react-router-app. Orchestrator miss: freshness was not re-run on the merged 0191 tree.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 071 phase 2, 395872ed)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 071 phases 3-4, e6f5e67d 9574507b)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
