# Phase 1 — Data model: the gateway holds no durable state

**This feature adds no tables and no migration.** That is the finding worth stating rather
than leaving as an absence: every durable thing the gateway needs already exists. Events live
in spec 004's `events`; identity lives in spec 005's `users` and `auth_sessions`. A gateway
that stored anything of its own would be storing a projection of the log, which is the thing
architecture A4 exists to avoid.

## In-memory structures

These live for the lifetime of the process and are rebuilt from nothing on restart — a
restart drops every connection, and every client reconnects with its cursor and is made whole
from the log. That is the property that makes holding them in memory acceptable (A2: one Node
process).

### `Connection`

| Field | Notes |
|---|---|
| socket | The open WebSocket. |
| `userId` | The identity established at upgrade (research D4). Immutable for the connection's life. |
| `role` | From the same validation. Used for visibility filtering. |
| `sessionId` | The play session subscribed to, or none until `subscribe`. |
| `deliveredThroughSeq` | Highest position written to this socket. |
| `pendingQueue` | Live events buffered during replay (research D1). Emptied and discarded once draining completes. |

**No password, token, or session-token hash is held.** The connection knows *who* it is, not
*how* it proved it. A token in memory is a credential in a heap dump.

### `SubscriberRegistry`

A map from `sessionId` to the set of connections subscribed to it. This is the whole of
fan-out: appending an event looks up the set and sends to each member (research D5,
independently, so one dead socket cannot fail the others).

Entries are removed on disconnect. An empty set is removed entirely so a long-running process
does not accumulate an entry per session ever visited.

## What the gateway must never do

- **Never write to `events` except through spec 004's `append`.** Bypassing it would bypass
  the advisory lock that makes positions gapless — the exact defect that lost ~44% of appends
  when it was measured without the lock.
- **Never read `events` directly.** `readFrom` is the contract; a direct query would
  reimplement cursor semantics and drift from it.
- **Never cache events.** Replay reads the log. A cache is an invalidation problem with no M0
  driver (research D1).
- **Never hold state a reconnect cannot rebuild.** If a client's correctness depends on
  something only this process knows, a restart silently corrupts it.

## Validation rules

- A `subscribe` requires a well-formed `sessionId`; `afterSeq` is optional and defaults to the
  origin, and a negative value is refused rather than clamped.
- A `send` requires `sessionId`, `eventType`, `payload`, and `payloadVersion`. `visibility` is
  optional and defaults at the log.
- `actor`, `seq`, and `ts` supplied by a client are **ignored**, not refused — a client
  sending them is confused, not hostile, and refusing would break a client that helpfully
  echoes a frame back. The server's values are authoritative regardless (FR-005, FR-006).
- A connection may subscribe to one session at a time in M0. A second `subscribe` replaces the
  first; multiplexing several sessions over one socket has no M0 driver.
