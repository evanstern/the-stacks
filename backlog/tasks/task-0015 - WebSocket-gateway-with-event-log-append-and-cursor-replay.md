---
id: TASK-0015
title: WebSocket gateway with event-log append and cursor replay
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 18:52'
labels: []
milestone: m-0
dependencies:
  - TASK-0012
  - TASK-0013
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove the realtime seam that all of M4 later rests on, per architecture A4. A client connects, sends a message, the server validates and appends it to the event log, and every subscriber receives it. Reconnect replays from a seq cursor. Authority is server-side: clients never write events directly.

Spec: specs/006-ws-gateway
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clients connect over WebSocket in the same Node process as the HTTP API
- [ ] #2 A client message is validated server-side and appended to the event log before any broadcast
- [ ] #3 All subscribers to a session receive newly appended events in seq order
- [ ] #4 A client subscribing from a seq cursor receives the events it missed, then live events, with no gaps or duplicates
- [ ] #5 Events carrying restricted visibility are filtered per viewer
- [ ] #6 Disconnect and reconnect are handled without dropping or double-delivering events
- [ ] #7 Tests cover append, fan-out, and replay from a cursor
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
