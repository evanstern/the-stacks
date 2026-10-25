---
id: TASK-0051
title: 'The Table: presence — who is at the table'
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
labels:
  - multiplayer
  - realtime
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/wiki/ws-protocol.md
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every client sees who is at the table, and the gate and the Director know which players are present.

Why: group sign-off (TASK-0049) needs the set of present players, and the Director should not wait on an absent one. The WebSocket protocol omits presence by design today (docs/wiki/ws-protocol.md), and its frame shapes are a frozen contract. Changing them is an operator checkpoint, so this card records a decision first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record states how presence is carried (protocol frame or session event) and why.
- [ ] #2 Every connected client sees the list of present players and the DM.
- [ ] #3 A disconnect updates presence within a stated timeout.
- [ ] #4 The gate and the Director read presence through one server-side interface.
- [ ] #5 Tests cover join, leave and reconnect.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
