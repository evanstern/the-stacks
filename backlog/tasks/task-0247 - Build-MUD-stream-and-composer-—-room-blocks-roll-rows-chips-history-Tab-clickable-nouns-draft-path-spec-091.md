---
id: TASK-0247
title: >-
  Build: MUD stream and composer — room blocks, roll rows, chips, history, Tab,
  clickable nouns, draft path (spec 091)
status: To Do
assignee: []
created_date: '2026-11-05 05:48'
updated_date: '2026-11-07 05:19'
labels:
  - web
  - ux
  - 'ws:table-ux'
milestone: m-10
dependencies:
  - TASK-0199
  - TASK-0236
priority: medium
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Stream and composer emit Intent pills; absorbs 0132, 0133, 0162, 0169, 0187, 0190, 0243; amend spec 091.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Second half of the TASK-0236 table redesign (docs/design/mud-ux/decision.md), split out 2026-11-05 by operator ruling 'Build independent half now'. Scene fields (R1: description, ways, cast), stream items (room blocks, roll rows, rules lines, filter chips), and the MUD composer (history, @ and / commands, Tab completion, clickable nouns, one draft(text) path the slide-out map TASK-0239 reuses). R1 (a) and R2 (a) ruled 2026-11-05. Lane: runbook C, after TASK-0199 (spec 066) merges; the spec lives on branch task-0236-mud-ux until TASK-0236 merges.

Spec: specs/091-mud-stream-and-composer
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0132 (Show progress between Commit and the DM's narration) by replan-2026-11: Progress indicator between fact rows and narration.

Merged from TASK-0133 (Render dice lines before and distinct from narration prose) by replan-2026-11: Roll rows render before prose.

Merged from TASK-0162 (Play composer keeps a line's draft until its echo lands) by replan-2026-11: Composer keeps draft until echo.

Merged from TASK-0169 (Roll lines name the ability, skill and roll mode of the check) by replan-2026-11: Roll rows name check and mode.

Merged from TASK-0187 (Play route: cap the transcript at 1024 px, centered) by replan-2026-11: Column width.

Merged from TASK-0190 (Narration sets NPC dialogue apart from the prose) by replan-2026-11: Dialogue rows.

Merged from TASK-0243 (Dice lines hide the dropped die on advantage and disadvantage) by replan-2026-11: Show both d20s.

Rewritten by replan-2026-11. Stream and composer emit Intent pills; absorbs 0132, 0133, 0162, 0169, 0187, 0190, 0243; amend spec 091.
<!-- SECTION:NOTES:END -->
