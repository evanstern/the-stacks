---
id: TASK-0095
title: 'WS gateway: duplicate event delivery at the subscribe replay/live boundary'
status: To Do
assignee: []
created_date: '2026-10-26 02:38'
labels:
  - server
  - ws
  - bug
dependencies: []
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A subscriber can receive the same event twice when it subscribes while other connections are sending. Observed as an intermittent CI failure in apps/server/test/ws.integration.test.ts T012 (run 40259790493 on PR 43, attempt 1): 15 event frames carried only 14 distinct seq values.

Race: gateway.ts awaits append() and then calls registry.broadcast(). Between the append commit and the broadcast, a subscriber mid-replay (subscribe.ts) can read the committed event from readFrom and send it. If replay then finishes and clears conn.pendingQueue before the broadcast runs, broadcast sends the event directly a second time. The drain-time skip (event.seq <= throughSeq) only covers events that landed in the queue.

Likely fix: track a per-connection delivered-through seq for each subscribed session. Skip any event at or below it on every path (replay, drain, direct broadcast). Add a deterministic test through the SubscribeDeps seam that commits an append, lets replay read it, and broadcasts after the queue clears.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A subscriber never receives two event frames with the same seq for one session, on any path (replay, queue drain, direct broadcast).
- [ ] #2 A deterministic test in ws.subscribe.test.ts reproduces the commit-then-late-broadcast ordering and fails without the fix.
- [ ] #3 ws.integration.test.ts T012 passes in 20 consecutive local runs.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
