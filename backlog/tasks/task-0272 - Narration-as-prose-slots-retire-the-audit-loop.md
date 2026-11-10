---
id: TASK-0272
title: Narration as prose slots; retire the audit loop
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 18:22'
labels:
  - 'ws:narration'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0245
  - TASK-0273
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The narrator fills restate, describe and ask slots from the fact sheet. Delete regenerate-then-fallback. Replace the audit with a code leak check (unrevealed ids) and a contradiction check against facts. A failed check appends a correction row and never blocks play.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-07).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No narration path regenerates for audit reasons.
- [ ] #2 Narration writes no digits; fact rows carry every number.
- [ ] #3 The R1 playtest shows zero fallback lines.
- [ ] #4 `dm/claims.ts` lexical gate is deleted.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 098 OQ-10: TASK-0245 owns the prose slots and the code-composed reply. This card retires the audit loop and renders PlanFact as why rows (spec 098 contract §6).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
