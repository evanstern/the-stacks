---
name: subscriber-registry
description: Connection bookkeeping for the WebSocket gateway — one session per connection, session isolation via a sessionId-to-connections map, isVisible filtering, and why a filtered event is never sent (seq gaps are correct), and the replayedThroughSeq replay floor that broadcast skips.
kind: component
sources:
  - apps/server/src/ws/registry.ts
verified_against: 7ed16122b2f78b65297508cc3ef69609507d79e9
---

# Subscriber registry

`createRegistry()` is the whole of fan-out: a `Map<sessionId, Set<Connection>>` plus
`subscribe`/`unsubscribe`/`broadcast`/`subscriberCount`. A `Connection` (defined here, built
once by [[websocket-gateway]] at upgrade time) carries `socket`, the authenticated `userId`
and `role`, the `sessionId` it's currently subscribed to (or `null`), and `pendingQueue` — the
buffer [[replay-live-boundary]] uses to queue live events during a replay — and
`replayedThroughSeq`, the replay floor described below.

## How it works

**Session isolation is structural, not filtered.** A connection subscribes to at most one
session at a time; calling `subscribe` again first calls `unsubscribe`, which removes it from
its old session's `Set` (deleting the set entirely if it empties, so no per-session-ever-
visited entry leaks forever). `broadcast(sessionId, frame)` only ever looks up the one
`Set` for `sessionId` — a connection subscribed elsewhere is never in scope to receive it, by
construction, not by a check.

**`isVisible(conn, event)`** is the single per-recipient visibility decision, exported so both
the live path (`registry.broadcast`, below) and the replay path
([[replay-live-boundary]]'s read loop) make the *exact same* decision instead of risking two
implementations drifting apart. M0's visibility model is minimal: `event.visibility ===
"public"` reaches everyone subscribed; any other value reaches only the connection whose
`userId` equals it — whisper-style per-person visibility.

**A filtered event is never sent — not sent-then-hidden.** `broadcast` calls `isVisible` per
connection and simply `continue`s past anyone it fails for; nothing is transmitted to that
socket for that event. This is why `seq` legitimately has gaps for some recipients: a
connection that was filtered out of event 7 has no way to distinguish "event 7 didn't happen"
from "event 7 wasn't for me" from its own message stream, and doesn't need to — the ordering
guarantee only promises every event a given connection *is* entitled to arrives in order.

`broadcast` iterates the `Set` and sends to each connection **independently** — deliberately
not `Promise.all` or one `try`/`catch` around the whole loop. One dead or closing socket must
never stop, or roll back, delivery to every other subscriber of an event the log has already
committed. A closed socket (`readyState !== OPEN`) or a `send` that throws is pruned from the
registry on the spot, the same as an explicit `close` event.

**Replay floor.** After the `isVisible` check, `broadcast` skips any event whose `seq` is at or
below `conn.replayedThroughSeq`. The field starts at `0` (set in [[websocket-gateway]]), is set
to the subscribe's `afterSeq` on entry to `subscribe()`, and to the replay's `throughSeq` just
before `pendingQueue` clears. The skip runs before the queue/send split, so it covers both
paths. It closes a race: the gateway appends, then broadcasts, so a replay may already have
delivered an event whose broadcast runs only after the queue is gone.

A connection whose `pendingQueue` is non-null (replay in flight) gets the event pushed onto
that queue instead of sent directly — only events that passed `isVisible` and the replay floor
are ever queued, so [[replay-live-boundary]]'s drain step needs no second filtering pass.

## Connections

Built and driven by [[websocket-gateway]]. Read and written by [[replay-live-boundary]] for
the queueing half of the replay/live boundary. Frame shape from [[ws-protocol]].

## Operational notes

`data-model.md` also names a `deliveredThroughSeq` field on `Connection`. It is still omitted:
`replayedThroughSeq` is a replay floor, not a running delivered-through watermark. Broadcasts
from concurrent senders may run out of seq order, so a watermark updated on every send could
drop a lower seq whose broadcast runs late. Each reconnect supplies its own `afterSeq` cursor,
so nothing reads a live watermark back server-side. The replay floor is lossless because the
event log's advisory lock commits seqs in order, so every seq at or below `throughSeq` was in
the replay read.
