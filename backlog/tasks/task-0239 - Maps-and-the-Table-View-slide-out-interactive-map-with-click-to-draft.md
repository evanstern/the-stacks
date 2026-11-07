---
id: TASK-0239
title: 'Maps and the Table View: slide-out interactive map with click-to-draft'
status: To Do
assignee: []
created_date: '2026-11-05 03:59'
updated_date: '2026-11-07 05:18'
labels:
  - ux
  - maps
  - replan-2026-11
milestone: m-6
dependencies:
  - TASK-0236
  - TASK-0071
priority: medium
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ship the map chosen in TASK-0236 (docs/design/mud-ux/decision.md): the map lives in the slide-out panel component, opened from the table margin; clicking a token or way on drafts a line into the composer through the draft path spec 086 builds. Authored geometry, token positions driven by events (OQ1). Every map fact also appears as text in the stream.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Open map in the margin opens the slide-out panel (right on desktop, bottom sheet at 390px)
- [ ] #2 Clicking a token or way on drafts a line into the composer and sends nothing
- [ ] #3 Token positions update from session events
- [ ] #4 Map facts have stream text parity for screen readers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0070 by replan-2026-11. Click-to-draft board.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
