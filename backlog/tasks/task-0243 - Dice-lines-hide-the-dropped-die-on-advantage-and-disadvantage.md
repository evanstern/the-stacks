---
id: TASK-0243
title: Dice lines hide the dropped die on advantage and disadvantage
status: To Do
assignee: []
created_date: '2026-11-05 04:15'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - narration
  - web
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a roll made with advantage or disadvantage shows both d20s on its dice line and in the ledger view, marks which was kept, and names the mode.

Why: runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 175, 183). Tamsin's longsword rolled with advantage from Kestrel's Help: faces 16 and 4, kept 16. The shipped dice line read '1d20+5 → 16 = 21 vs AC 15: hit'. Operator: 'I'm not sure if I see both rolls (may have dropped the low one in narration and it shouldnt)'. Cause: apps/server/src/dm/facts.ts shownFaces returns the natural (kept) face only, and the line never states the mode. With advantage now coming from engine rules (TASK-0104 conditions, TASK-0128 Help), every such roll hides a die.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dice line for an advantage or disadvantage roll shows both faces, which was kept, and the mode (e.g. '2d20kh1+5 → 16, 4 = 21 (advantage)'), with a facts test replaying seq 175
- [ ] #2 The play-route ledger view shows the same, with a web test
- [ ] #3 The auditor's dice-lines check accepts the new form, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 seq 349: a critical hit's damage line reads '1d8+2 → 7+4 = 13' (no 2d8, the doubled die looks like a modifier) then 'takes 4 piercing (4→0 HP)'. Same family: dice lines do not show how the engine rolled.

Merged into TASK-0247 by replan-2026-11. Show both d20s.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
