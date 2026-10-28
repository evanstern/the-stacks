---
id: TASK-0162
title: Play composer keeps a line's draft until its echo lands
status: To Do
assignee: []
created_date: '2026-10-28 03:31'
labels:
  - play-route
  - web
dependencies:
  - TASK-0157
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a player never has to retype a line the gate refused. Today the play-route composer clears the draft as soon as a line is sent, so any refusal (CONFLICT, floor codes, NOT_AUTHORIZED) loses the text. Deferred from TASK-0157 Q4 (operator ruling 2026-10-27: default accepted, 'a separate card'). After TASK-0157 a same-process CONFLICT no longer occurs, so this is a maybe. Revisit trigger: the TASK-0053 demo or any playtest shows a player retyping a refused line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A refused talk line's text is back in the composer with the refusal notice
- [ ] #2 A line that lands clears the draft once, on its echo
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
