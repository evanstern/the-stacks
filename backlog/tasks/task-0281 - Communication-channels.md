---
id: TASK-0281
title: Communication channels
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
labels:
  - 'ws:table-ux'
  - replan-2026-11
  - ep-3
milestone: m-12
dependencies: []
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ship six channels: in-character, address NPC, emote, ask DM, table talk, whisper. Table talk and whispers are filtered on the server. The channel chip keeps "talking to" memory.

Parent epic: TASK-0260.

Source: docs/design/replan-2026-11/board-rework-map.md (N-16).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Table talk never reaches the narrator or NPC context (test).
- [ ] #2 A whisper reaches only its recipients.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
