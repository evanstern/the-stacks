---
id: TASK-0108
title: 'Revisit: Director and interpret transcript lines name characters, not user ids'
status: To Do
assignee: []
created_date: '2026-10-26 18:11'
labels:
  - dm
  - revisit
milestone: m-3
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
