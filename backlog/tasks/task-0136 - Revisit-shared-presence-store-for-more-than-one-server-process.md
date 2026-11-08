---
id: TASK-0136
title: 'Revisit: shared presence store for more than one server process'
status: To Do
assignee: []
created_date: '2026-10-27 03:37'
updated_date: '2026-11-07 05:17'
labels:
  - revisit
  - realtime
  - deferred
milestone: m-18
dependencies: []
priority: low
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when a second server process (horizontal scale, a separate worker process, or blue-green with overlap) is planned. Context: TASK-0051 (specs/035-presence) keeps presence in one process's memory behind a PresenceReader read by the WebSocket gateway, the gate and the DM worker. Operator ruling 2026-10-26 at TASK-0051 checkpoint C2: 'Card the revisit'. Decide a shared store (Postgres LISTEN/NOTIFY, Redis, or sticky sessions) and how the logged presence marker stays consistent across processes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record picks the shared presence mechanism before the second process ships
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred by replan-2026-11 to Later. Trigger: multi-process deployment.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
