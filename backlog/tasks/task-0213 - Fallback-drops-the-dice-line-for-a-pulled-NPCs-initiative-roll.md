---
id: TASK-0213
title: Fallback drops the dice line for a pulled NPC's initiative roll
status: To Do
assignee: []
created_date: '2026-11-02 23:21'
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
- [ ] #1 The auditor's dice-lines check passes on a replay of seq 97-103, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
