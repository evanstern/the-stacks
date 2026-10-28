---
id: TASK-0164
title: Table shows who controls each party character
status: To Do
assignee: []
created_date: '2026-10-28 05:50'
labels:
  - play-route
  - web
dependencies:
  - TASK-0163
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every viewer at a table can see each party character and who controls it (a named human, or an AI companion), and which one is their own. Today the play header shows presence chips for humans and the AI DM only; an AI companion such as Brother Odo has no chip, and a seat's snapshot view has no own-character marker (TASK-0163 Phase 2 evidence/two-human-check.md, Phase 6 live run). Players learn their own character only from the speaker select. This is a maybe. Revisit trigger: the TASK-0163 hosted-dev alpha run or the TASK-0053 demo shows a player confused about who plays a character.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The table lists each party character with its controller (human display name or AI companion)
- [ ] #2 A player's own character is marked
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
