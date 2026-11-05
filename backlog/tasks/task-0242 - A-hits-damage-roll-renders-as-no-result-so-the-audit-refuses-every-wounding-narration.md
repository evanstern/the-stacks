---
id: TASK-0242
title: >-
  A hit's damage roll renders as 'no result', so the audit refuses every
  wounding narration
status: Done
assignee: []
created_date: '2026-11-05 04:07'
updated_date: '2026-11-05 05:30'
labels:
  - dm
  - narration
  - playtest
  - bug
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 226000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an attack's damage roll reaches NarrationFacts as damage dealt (amount, type, target), so the narrator may show the wound and the audit does not call it unsupported.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 163-170). The goblin by the fire hit Tamsin (18 vs AC 16) for 4 piercing (13→9). All three narration attempts were refused: 'Damage roll shows no result in facts, but narration states 4 hit points…' / 'The damage roll is recorded as no result in facts, but the prose narrates a wound'. The fallback shipped. Cause: TASK-0104 (spec 082) submits hit damage as its own submission at key '<key>:dmg' with outcome null; prompts/narrate.ts rollEntry renders a roll with no outcome as '-> no result'. The narrate rule says 'Never show a wound unless a fact records damage', and the audit reads the 'no result' line as no damage. The hp.changed row (seq 166) is in the ledger but the roll line contradicts it. Every damaging hit hits this.

Related: TASK-0104 (spec 082), TASK-0214 (audit pass rate).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A damage roll's fact line states the damage dealt (amount and target), not 'no result', with a facts test replaying seq 163-166
- [x] #2 A narration showing that wound passes the audit, with a scripted-audit test over seq 163-170
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Narrowed by run 1 seq 172-192: a PC's hit (Tamsin on Snag, seq 176-183) rendered its damage and passed the audit on attempt 1. The 'no result' line hits NPC-turn hits only (seq 163-170 goblin-4, seq 185-192 lookout): the NPC turn's ':dmg' submission reaches npcTurn facts with no outcome. Look at the npcTurn roll path in facts.ts, not the PC action path.

Claimed 2026-11-05 by M3 runbook B2 (docs/design/m3-runbook-b2-playtest-fixes.md, PR #132). Worktree .worktrees/task-0242, branch task-0242-npc-hit-damage-line, cut from origin/main 8128fb3a. No spec dir: signed escape line E1 covers this task.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (E1 implementation)

NPC hit damage roll now renders 'damage dealt: n type to target' (narrate-v19); facts + scripted-audit tests cover seq 163-170 and 185-192. Commits 99fc414e, a713cb6e
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR #133 (bef9c4d5), runbook B2 spine #1, escape E1. An NPC hit's damage roll now states damage dealt (amount, type, target) from the same batch's hp.changed row; dealt null when the ledger has none. narrate-v19. Facts replay seq 163-166, scripted-audit replay seq 163-170 and 185-192.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
