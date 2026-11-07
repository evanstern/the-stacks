---
id: TASK-0166
title: 'Revisit: human DM writes a scene with no seed'
status: To Do
assignee: []
created_date: '2026-10-28 07:53'
updated_date: '2026-11-07 05:18'
labels:
  - play-route
  - revisit
  - replan-2026-11
dependencies:
  - TASK-0159
priority: low
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit card (a maybe). TASK-0159 (spec 055, DC-2, OQ-2 A) locks the scene id to the source suggestion, so a human DM cannot write a scene that has no seed. The AI DM cannot run a scene whose id is not in the seed. Revisit trigger: a playtest or the TASK-0053 demo shows a human DM needing a scene the seed does not hold. On trigger, spec how an unseeded scene reaches the AI DM, or drop this card by a decision record. Operator ruling 2026-10-28: "card DC-2 as a revisit".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger fired and a spec covers unseeded human-DM scenes, or a decision record drops this card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0284 by replan-2026-11. Improvise a scene in the console.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
