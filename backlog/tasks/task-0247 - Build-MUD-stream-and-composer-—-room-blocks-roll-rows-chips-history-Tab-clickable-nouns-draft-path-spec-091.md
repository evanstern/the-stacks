---
id: TASK-0247
title: >-
  Build: MUD stream and composer — room blocks, roll rows, chips, history, Tab,
  clickable nouns, draft path (spec 091)
status: To Do
assignee: []
created_date: '2026-11-05 05:48'
updated_date: '2026-11-07 05:25'
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

Intent: keep the spec 091 stream, roll rows and composer baseline. Clickable nouns, ways and Tab completion draft Intent pills at the `draft` commit state, which lives only in the client. Slash commands parse through the N-01 (TASK-0266) text grammar. Roll rows render the code facts from TASK-0245. Absorbed: progress indicator between fact rows and narration (0132); roll rows before prose (0133); draft kept until echo (0162); roll rows name check and mode (0169); 1024 px column (0187); dialogue rows (0190); both d20s shown (0243). Amend spec 091 after CP-4. UI: no modals.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): second half of the TASK-0236 table redesign (docs/design/mud-ux/decision.md): scene fields, room blocks, roll rows, rules lines, filter chips, and a MUD composer with one draft(text) path, built on spec 066.

Spec: specs/091-mud-stream-and-composer
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Spec 091 is amended after CP-4 so clickable nouns, ways and Tab completion draft Intent pills.
- [ ] #2 Clicking a noun or way drafts an Intent pill at draft state; nothing is sent until the player sends it.
- [ ] #3 Slash commands in the composer parse through the N-01 text grammar to Intents, with a test.
- [ ] #4 Roll rows render code facts before prose, name the check and roll mode, and show both d20s.
- [ ] #5 A progress indicator shows between fact rows and narration until the first narration token arrives.
- [ ] #6 The composer keeps a line's draft until its echo lands, with a test.
- [ ] #7 NPC dialogue renders as distinct rows, and the transcript column is capped at 1024 px and centred.
<!-- AC:END -->

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

AC re-authored by replan-2026-11.
<!-- SECTION:NOTES:END -->
