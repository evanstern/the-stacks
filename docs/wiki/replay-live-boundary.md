---
name: replay-live-boundary
description: The algorithm that delivers a reconnecting client its missed events then live ones with no gap and no duplicate — join the registry first with delivery queued, replay in bounded batches, signal replay-complete, record the replay floor (replayedThroughSeq), then drain the queue; the DM seat is loaded once per session and filters replay per viewer; broadcast applies the same floor on the direct path.
kind: pipeline
sources:
  - apps/server/src/ws/subscribe.ts
verified_against: a10626b197d0bf98fc8949c4d8f2a2b7eeb9b10c
---

# Replay/live boundary

`subscribe()` is what a `subscribe` frame runs. Its job is exactly-once delivery across a
reconnect: every event after the client's `afterSeq` cursor, in order, with nothing missed and
nothing delivered twice — even though replay (a bounded read of past events) and live delivery
(future broadcasts) are two different code paths racing against each other.

## How it works

Both of the obvious orderings are wrong:

- **Replay, then subscribe.** An event appended *during* the replay read is missed entirely —
  it happened after the read's snapshot but before the connection was registered to receive
  broadcasts.
- **Subscribe, then replay.** An event appended in the gap between subscribing and starting
  the replay read arrives twice: once live (because the connection is now registered) and
  once again in the replay's range.

`subscribe()` does neither. It:

1. **Joins the registry first, with delivery queued.** `conn.pendingQueue = []` and
   `conn.replayedThroughSeq = afterSeq` are set before `registry.subscribe(conn, sessionId)` — from this line on, [[subscriber-registry]]'s
   `broadcast` pushes matching events into `pendingQueue` instead of sending them directly
   (checked via `conn.pendingQueue` being non-null). This closes the race window entirely:
   nothing appended from this point forward can be lost — it lands in the replay read below,
   in the queue, or (harmlessly) both.
2. **Replays from the cursor in bounded batches.** A loop calls `readFrom(db, { sessionId,
   afterSeq: throughSeq, limit: REPLAY_BATCH_SIZE })`, sending each visible event (per
   `canSee(viewer, ...)`, [[subscriber-registry]]) and advancing `throughSeq` to the batch's last `seq`.
   `REPLAY_BATCH_SIZE` is `200` — bounded so a reconnecting client with a long history can't
   exhaust the server with one unbounded read. The loop stops once a batch comes back shorter
   than the limit; it never has to "catch" the live edge exactly, because anything past it is
   already safe in the queue from step 1.
3. **Sends `replay-complete` once**, carrying the final `throughSeq`, before any live delivery.
4. **Records the replay floor, then drains the queue.** `conn.replayedThroughSeq = throughSeq`
   is set *before* `pendingQueue` is cleared. The drain skips anything at or before that floor
   — the position-based skip that makes the overlap between replay and queued events harmless
   — then clears `pendingQueue` to `null`, switching the connection to direct delivery.

The drain skip alone is not enough. The gateway appends, *then* broadcasts, so a replay can
read a just-committed event, send it, and clear the queue before that event's `broadcast`
runs; the late broadcast would then send it a second time on the direct path. The floor
outlives the queue: [[subscriber-registry]]'s `broadcast` skips any event with `seq <=
conn.replayedThroughSeq` on both the queue and direct paths. The floor is deliberately **not**
a running delivered-through watermark: broadcasts from concurrent senders may run out of seq
order, so a watermark advanced on every send could drop a lower seq whose broadcast runs late.
Every seq at or below the replay's `throughSeq` was in the replay read, so skipping exactly
those is lossless.

**The DM seat.** After joining the registry and before the read loop, `subscribe()` takes the
session's `DmSeat` from the registry cache (`seatOf`). On a miss it awaits `loadDmSeat` (see
[[event-log]]; the latest `dm.seat.changed` row, else the AI DM), then re-reads the cache: a seat
a concurrent broadcast set during the await wins over the load, and only otherwise is the loaded
seat cached. `viewerFor(conn, seat)` gives the replay's `Viewer`. This closes the DM-seat
subscribe race fixed in TASK-0045.

5. **Sends a presence snapshot, if opted in.** After the drain, a connection with
   `wantsPresence` gets one `presence` frame from the tracker's reader (`subscribe` takes an
   optional `presence` dep). It comes after `replay-complete` and the drained queue, and it is
   outside the exactly-once machinery: a snapshot is the whole set, so it needs no cursor
   ([[presence]]).

Visibility is decided exactly once, at broadcast/queue time (`canSee` in
[[subscriber-registry]]) and again independently by the replay loop's own read — draining the
queue needs no second filtering pass, since only events the connection was entitled to see
were ever queued.

## Connections

Called from [[websocket-gateway]]'s message handler on a `subscribe` frame. Reads via
[[event-log]]'s `readFrom`. Frame shapes from [[ws-protocol]]. Consumed on the client by
[[client-session-hook]], which supplies `afterSeq` as its highest-ever-delivered `seq`.

## Operational notes

`subscribe()` takes an injectable `deps: SubscribeDeps` seam (`readFrom`, and an optional `loadDmSeat`) purely for test
determinism — the race window it closes is a synchronous gap, so no amount of concurrent write
pressure reliably lands an append inside the broken orderings on demand (the end-to-end
integration test caught a reintroduced bug only about 1 run in 7 without it). Production
callers omit `deps` and get the real `readFrom` and `loadDmSeat`; it is not test-only scaffolding left behind,
it's the only way `ws.subscribe.test.ts` can be deterministic. The same file also holds a
database-gated test for the append-then-broadcast case above: its injected `readFrom` performs a
real `append`, then the test calls `registry.broadcast` after `subscribe` returns and asserts
the event was sent once.
