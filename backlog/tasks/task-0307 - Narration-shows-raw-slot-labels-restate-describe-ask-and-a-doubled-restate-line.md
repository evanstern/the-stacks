---
id: TASK-0307
title: >-
  Narration shows raw slot labels (restate:, describe:, ask:) and a doubled
  restate line
status: In Progress
assignee: []
created_date: '2026-11-10T21:30:00Z'
updated_date: '2026-11-11T01:17:00Z'
labels:
  - playtest
  - ws:narration
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-10-r1-lane-playtest.md
priority: high
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the 2026-11-10 playtest on vm-104 (session 86abad65, every narration). The model writes the slots as plain 'restate:', 'describe:', 'ask:' labels, but parseSlots in apps/server/src/dm/fact-sheet.ts only recognises the bracketed form ([describe]). The whole reply lands in the describe slot with its labels intact, so players read 'restate: …', 'describe: …', 'ask: …'. Because the restate slot comes back empty, the code fallback 'Tamsin Vale means to: "<raw text>".' is also prepended, so the action is said twice. The ask slot still carries a 'what do you do next' style question on routine turns.

Fix candidates: accept both tag forms (and strip them); or ask the model for structured slots; keep untagged replies as describe for the fake scripts. Regression fixture: any narration from session 86abad65.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Narration never shows a slot label to players; both 'label:' and '[label]' forms are parsed and stripped, with a test built from session 86abad65.
- [ ] #2 When the model writes a restate, the code fallback 'means to' line does not also appear.
- [ ] #3 The ask slot appears only for a genuine clarification, not as a routine prompt to act.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-10 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0307, branch task-0307-slot-labels, cut from origin/main 0da0aafb. No spec dir: signed escape line covers this task.

Escape line E9 (operator, 2026-11-10, in chat: 'Escape line, Sonnet (Recommended)'): no spec set; the card's AC drive. Tier: sonnet.
<!-- SECTION:NOTES:END -->
