---
id: TASK-0108
title: 'Revisit: Director and interpret transcript lines name characters, not user ids'
status: To Do
assignee: []
created_date: '2026-10-26 18:11'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - revisit
  - replan-2026-11
dependencies: []
priority: low
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when a captured run shows the Director or interpret confusing which character acted (wrong actor in a decision or reading).

Context: TASK-0106 (specs/034-narration-quality) found that transcript lines show a user id instead of the character name. That made the chronicle guess the wrong actor (run 5 F76), and TASK-0106 fixed it for the narrate and chronicle paths. The Director and interpret transcripts have the same user-id rendering, with no evidence yet that it hurts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Director and interpret transcript lines render the acting character's name, with a test
- [ ] #2 The triggering evidence is cited on this card
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-02 (M3 planning, orchestrator session local_6a4a04a4): research, doctrine and low-priority revisits move out of m-3. Milestone cleared, revisit label added. Re-enter a milestone when its trigger fires.

Merged into TASK-0060 by replan-2026-11. Names come from entities in the compiled context.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
