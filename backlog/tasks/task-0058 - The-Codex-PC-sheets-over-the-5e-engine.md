---
id: TASK-0058
title: 'The Codex: PC sheets over the 5e engine'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
updated_date: '2026-11-07 05:18'
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

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: a player character's sheet is a codex PC entity whose mechanics the 5e engine computes and enforces. Players view their sheet; the engine updates it through session events.

Why: the old Sheets milestone dissolved into M2 (engine) and M4 (sheets) by decision-0010. Sheets touch combat rules, so this card waits for the parked-rules decision (TASK-0055).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A PC entity stores class, level, ability scores, proficiencies, equipment and spells as engine records.
- [ ] #2 The engine derives AC, HP maximum, spell slots and modifiers from the PC entity, and tests cover each derivation.
- [ ] #3 Session events change HP, conditions and slots; the sheet view reads them from projections.
- [ ] #4 A player views their own PC sheet, and the DM views every sheet.
- [ ] #5 Any rule adopted by TASK-0055 is reflected, or the card notes that none was adopted.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. PC as codex entity over the engine; absorbs 0241 (pronouns).

Merged from TASK-0241 (Party characters carry pronouns, and narration uses them) by replan-2026-11: Pronouns on the PC entity.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
