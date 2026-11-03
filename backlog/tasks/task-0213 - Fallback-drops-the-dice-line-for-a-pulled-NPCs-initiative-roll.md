---
id: TASK-0213
title: Fallback drops the dice line for a pulled NPC's initiative roll
status: Done
assignee: []
created_date: '2026-11-02 23:21'
updated_date: '2026-11-03 06:04'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies:
  - TASK-0194
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: medium
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every roll in a turn's ledger appears as a dice line in the shipped narration, including initiative rolled when an NPC is pulled into the fight.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653). The deterministic auditor (dice-lines check) failed at seq 103: 'The dice lines differ from the ledger (expected 1, found 0)'. Snag's NPC turn pulled Pell in (TASK-0194): combatant.added, then Pell's initiative roll (seq 98, 16). The narration fell back after 3 refusals, and the fallback printed no dice line for that roll.

Where: apps/server/src/dm/fallback.ts and facts.ts (the pull's initiative roll), and the TASK-0194 pull path in resolve.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The auditor's dice-lines check passes on a replay of seq 97-103, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0213, branch task-0213-pull-in-dice-line, cut from origin/main bed923f4. No spec dir: signed escape line covers this task. Spine #12. Escape line E3 (card ACs drive).

Tier change from the runbook's haiku: the fix is a root-cause hunt across facts, render and fallback, not one mechanical edit, so it runs at the default tier (sonnet; no escalation).
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (E3 implementation)

Root cause: pullIn discarded the batch ids it wrote, so the joiner's initiative roll never reached NarrationFacts (both the NPC-turn and the PC-action paths). Fix: NPC path folds pull batches into npcTurn.batchIds; PC path returns pullBatchIds into a new facts.pulled, which renderDiceLines prints and the audit counts, never changing an action's outcome. narrate-v14. Orchestrator review added the PC path and the version bump. Gates on the final tree: ci:check green with the DB suite; freshness OK; spec-bridge ok.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every roll in a turn's ledger now renders a dice line, including the initiative roll of an actor pulled into the fight, on both the NPC-turn and PC-action paths; the fallback inherits it. Escape line E3.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
