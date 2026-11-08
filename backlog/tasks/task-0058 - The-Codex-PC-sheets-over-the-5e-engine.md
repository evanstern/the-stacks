---
id: TASK-0058
title: 'The Codex: PC sheets over the 5e engine'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
updated_date: '2026-11-07 05:24'
labels:
  - codex
  - engine
  - ui
  - 'ws:codex'
milestone: m-11
dependencies:
  - TASK-0057
  - TASK-0055
references:
  - docs/design/architecture.md
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: PC as codex entity over the engine; absorbs 0241 (pronouns).

Intent: a player character is a codex `pc` entity (TASK-0056) whose mechanics are engine records. The engine derives and enforces the numbers; session events change them; a sheet projection folds both per viewer. The entity carries pronouns, and narration uses them (absorbed TASK-0241). The sheet drawer UI is N-17 (TASK-0282, R3); this card ships the entity and the projection it reads.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): a sheet as a codex PC entity viewed by players, waiting on the parked-rules decision (TASK-0055) per decision-0010.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A codex pc entity stores class, level, ability scores, proficiencies, equipment and spells as engine records.
- [ ] #2 The engine derives AC, HP maximum, spell slots and modifiers from the entity, with a test per derivation.
- [ ] #3 Session events change HP, conditions and slots, and the sheet projection folds them over the entity.
- [ ] #4 The sheet projection gives a player only their own PC and gives the DM every PC, with a test.
- [ ] #5 The pc entity carries pronouns, and the compiled context and fact sheet use them, with a test.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. PC as codex entity over the engine; absorbs 0241 (pronouns).

Merged from TASK-0241 (Party characters carry pronouns, and narration uses them) by replan-2026-11: Pronouns on the PC entity.

AC re-authored by replan-2026-11.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
