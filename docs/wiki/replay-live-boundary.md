---
name: replay-live-boundary
description: The algorithm that delivers a reconnecting client its missed events then live ones with no gap and no duplicate — join the registry first with delivery queued, replay in bounded batches, signal replay-complete, then drain the queue skipping already-replayed positions.
kind: pipeline
sources:
  - apps/server/src/ws/subscribe.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
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

1. **Joins the registry first, with delivery queued.** `conn.pendingQueue = []` before
   `registry.subscribe(conn, sessionId)` — from this line on, [[subscriber-registry]]'s
   `broadcast` pushes matching events into `pendingQueue` instead of sending them directly
   (checked via `conn.pendingQueue` being non-null). This closes the race window entirely:
   nothing appended from this point forward can be lost — it lands in the replay read below,
   in the queue, or (harmlessly) both.
2. **Replays from the cursor in bounded batches.** A loop calls `readFrom(db, { sessionId,
   afterSeq: throughSeq, limit: REPLAY_BATCH_SIZE })`, sending each visible event (per
   `isVisible`, [[subscriber-registry]]) and advancing `throughSeq` to the batch's last `seq`.
   `REPLAY_BATCH_SIZE` is `200` — bounded so a reconnecting client with a long history can't
   exhaust the server with one unbounded read. The loop stops once a batch comes back shorter
   than the limit; it never has to "catch" the live edge exactly, because anything past it is
   already safe in the queue from step 1.
3. **Sends `replay-complete` once**, carrying the final `throughSeq`, before any live delivery.
4. **Drains the queue**, skipping anything at or before `throughSeq` — the position-based skip
   that makes the unavoidable overlap between replay and queued events harmless instead of
   duplicated — then clears `pendingQueue` to `null`, switching the connection to direct
   delivery for everything after.

Visibility is decided exactly once, at broadcast/queue time (`isVisible` in
[[subscriber-registry]]) and again independently by the replay loop's own read — draining the
queue needs no second filtering pass, since only events the connection was entitled to see
were ever queued.

## Connections

Called from [[websocket-gateway]]'s message handler on a `subscribe` frame. Reads via
[[event-log]]'s `readFrom`. Frame shapes from [[ws-protocol]]. Consumed on the client by
[[client-session-hook]], which supplies `afterSeq` as its highest-ever-delivered `seq`.

## Operational notes

`subscribe()` takes an injectable `deps: SubscribeDeps = { readFrom }` seam purely for test
determinism — the race window it closes is a synchronous gap, so no amount of concurrent write
pressure reliably lands an append inside the broken orderings on demand (the end-to-end
integration test caught a reintroduced bug only about 1 run in 7 without it). Production
callers omit `deps` and get the real `readFrom`; it is not test-only scaffolding left behind,
it's the only way `ws.subscribe.test.ts` can be deterministic.
