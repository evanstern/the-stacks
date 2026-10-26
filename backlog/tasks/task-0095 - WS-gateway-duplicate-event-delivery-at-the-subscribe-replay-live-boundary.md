---
id: TASK-0095
title: 'WS gateway: duplicate event delivery at the subscribe replay/live boundary'
status: In Progress
assignee: []
created_date: '2026-10-26 02:38'
updated_date: '2026-10-26 02:50'
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
- [x] #1 A subscriber never receives two event frames with the same seq for one session, on any path (replay, queue drain, direct broadcast).
- [x] #2 A deterministic test in ws.subscribe.test.ts reproduces the commit-then-late-broadcast ordering and fails without the fix.
- [x] #3 ws.integration.test.ts T012 passes in 20 consecutive local runs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Connection.replayedThroughSeq: the highest seq a subscribe's replay read (starts at afterSeq).
2. subscribe.ts sets it to afterSeq on entry and to the final throughSeq before clearing pendingQueue.
3. registry.broadcast skips direct sends at or below it; the drain skip uses the same floor.
Why a replay floor, not a running delivered watermark: broadcasts are not guaranteed to run in seq order across concurrent senders, so a running watermark could drop a lower seq whose broadcast runs late. Every seq at or below the replay's throughSeq was in the replay read (the advisory lock commits seqs in order), so skipping them is exact.
4. Deterministic test in ws.subscribe.test.ts via SubscribeDeps: commit, replay reads it, queue clears, then late broadcast.
5. Update registry.ts comment and wiki notes; loop T012 20x.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Fix committed as 1d95cb6: Connection.replayedThroughSeq replay floor; broadcast skips seq <= floor on queue and direct paths. New deterministic test 'replay/append/broadcast race (TASK-0095)' fails with the broadcast skip removed (expected [1,1] to equal [1]) and passes with it. Full server suite 417 passed / 5 skipped; typecheck and biome clean. T012: 20/20 consecutive local passes (implementer), re-verified 20/20 by orchestrator.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Wiki re-grounded in 80a2c36 (replay-live-boundary, subscriber-registry, test-suite, websocket-gateway). Plan gate empty; freshness exits 0. test-suite counts re-run by orchestrator: 48 pass / 45 skip without DB, 93 pass with DB.

Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5
That dispatch (re-ground dnd5e-engine.md, stale on main since 2c9f99e) was blocked by a PreToolUse hook and committed nothing. Its pin bump was reverted. The drift predates this task, so it is carded separately. Merged origin/main (PR 43); restored main's test-suite prose lost in the pin-conflict resolution and re-pinned to c2adddc after verifying tsconfig.json references.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
