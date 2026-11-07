---
id: TASK-0148
title: 'NPC and information: Seed information ids and the reveal fact'
status: To Do
assignee: []
created_date: '2026-10-27 03:58'
updated_date: '2026-11-07 05:24'
labels:
  - dm
  - npc
  - rules-gate
  - 'ws:codex'
milestone: m-11
dependencies:
  - TASK-0140
  - TASK-0143
priority: medium
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Info ids become codex clue/secret ids; `info.revealed` generalised per P-10.

Intent: knowledge items become codex `clue` and `secret` entities with stable ids. A reveal is the session event `info.revealed {entityId, blockId|field, to}` (decision-0026 generalised); it is never a toggle. A projection folds reveals into each player's known set, which drives 'View as player' (R2 exit criterion 4). The leak check of N-07 (TASK-0272) uses these ids.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): ids on seed `hooks.knows`, `hooks.secrets` and beat `clues`, an `info.revealed` fact, and an output gate refusing unrevealed DM-only text (decision-0026, D18; operator rulings 2026-10-26).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every clue and secret is a codex entity with a stable id, and a reference to a missing id fails validation.
- [ ] #2 info.revealed {entityId, blockId or field, to} is a session event, and no reveal is a toggle.
- [ ] #3 A projection folds reveals into each player's known set, and View as player shows only revealed blocks.
- [ ] #4 A reveal by an NPC must name a clue or secret that NPC knows, else the gate refuses it.
- [ ] #5 The N-07 leak check flags player-facing text naming an unrevealed clue or secret id, with a test.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Info ids become codex clue/secret ids; `info.revealed` generalised per P-10.

AC re-authored by replan-2026-11.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
