# Contract — the WebSocket protocol

**Status: binding for TASK-0016.** The SPA is written against this. Changing a frame shape
after 0016 starts is an operator checkpoint, not an implementer decision.

All frames are JSON objects with a `type` discriminator. Anything that does not parse, or
whose `type` is unknown, is refused — nothing is appended (FR-003).

## Connecting

`GET /ws` with the `Upgrade: websocket` header and the session cookie.

**Authentication happens at upgrade** (research D4). The socket opens only for a valid
session; it is never opened-then-closed. Three outcomes:

| outcome | meaning |
|---|---|
| upgrade succeeds | the connection has an identity for its whole life |
| `401` | no valid session — the client should sign in |
| `503` | validation could not be performed (datastore unreachable) — the client should retry |

The `401`/`503` split matters (FR-013): a client that treats a database blip as "signed out"
logs the user out spuriously.

## Client → server

### `subscribe`

```json
{ "type": "subscribe", "sessionId": "<uuid>", "afterSeq": 0, "presence": true }
```

Joins the play session and begins replay from `afterSeq` (omitted or `0` means from the
beginning). Delivery order is guaranteed across the replay/live boundary (research D1): the
client receives missed events in order, then live ones, with no gap and no duplicate.

### `send`

```json
{ "type": "send", "sessionId": "<uuid>", "eventType": "chat", "payload": { }, "payloadVersion": 1, "visibility": "public" }
```

Asks the server to record an event. **This is a request, not an event** — it becomes one only
if the server validates and appends it.

**The server ignores**, and the client must not send: `actor`, `seq`, `ts`. The actor is the
identity the connection authenticated as (FR-005); position and timestamp are assigned by
the log (FR-006). A client that could set any of the three could forge history.

## Server → client

### `event`

```json
{ "type": "event", "event": { "sessionId": "...", "seq": 7, "actor": "...", "type": "chat", "payload": {}, "payloadVersion": 1, "visibility": "public", "ts": "..." } }
```

One recorded event. Sent for both replayed and live events — **the same frame shape for
both**, deliberately: a client that had to handle them differently would need to know which
phase it was in, and the whole point of D1 is that it does not.

**`seq` may have gaps** for a recipient who is filtered out of some events (research D2).
This is correct, not a missed event. **A client tracks the highest `seq` it has been
delivered** and passes that as `afterSeq` on reconnect — it must not assume contiguity or it
will re-request forever.

### `replay-complete`

```json
{ "type": "replay-complete", "throughSeq": 7 }
```

Sent once, after the last replayed event and before live delivery. A client may use it to
hide a loading state. It is **not** required for correctness — ordering already guarantees
what a client needs — but a client that wants to distinguish "caught up" from "quiet
session" cannot otherwise tell them apart.

### `presence`

```json
{ "type": "presence", "sessionId": "<uuid>", "present": [{ "userId": "<uuid>", "displayName": "Ana" }] }
```

Sent only to a connection whose latest `subscribe` carried `presence: true` (optional; absent or
`false` means today's stream exactly). Sent once after `replay-complete`, then on every change.
A full snapshot sorted by `userId`, humans only, one entry per user. A client replaces its set
on each frame.

### Heartbeat

The server sends a protocol-level ping every 10 s. A connection that has not answered the
previous ping is terminated. No frame is involved.

### `error`

```json
{ "type": "error", "kind": "validation" | "forbidden" | "internal", "message": "..." }
```

A refused request. The connection stays open: one bad frame is not a reason to disconnect a
client that may immediately send a good one.

## Guarantees this protocol makes

1. **Appended before broadcast** (FR-004) — nothing is delivered that is not in the log.
2. **One order for everyone** (FR-007) — every subscriber to a session sees the same events
   in the same order.
3. **Session isolation** (FR-008) — a subscriber never receives another session's events.
4. **Exactly-once across reconnect** (FR-009, SC-003) — replaying from the last delivered
   `seq` yields every missed event, none twice, including events appended during the replay.
5. **Never-sent, not hidden** (FR-011) — a filtered event does not reach the client at all.

## What this protocol deliberately does NOT provide

- **No acknowledgements.** A `send` is not confirmed except by the resulting `event` frame
  arriving, which every subscriber including the sender receives. A separate ack would be a
  second delivery path to keep consistent with the first.
- **No typing indicators or room membership.** Later features; they need no
  protocol space reserved now. (Presence was added by decision-0024.)
- **No play-session creation or listing.** No session registry exists (spec 004 left
  `session_id` opaque); a client subscribes to an identifier it already knows.
- **No client-side write path.** By construction (FR-014).

> Extended by `specs/029-proposal-gate/contracts/ws-delivery.md`: `send` is classified (gate
> request, other catalogued type refused with `CATALOG_TYPE_REQUIRES_GATE`, else uncatalogued
> append); `error` frames gain an optional `code`; delivery filters per recipient with
> `canSee` against the session's DM seat.

> Amended by `specs/043-retire-uncatalogued-send` (TASK-0099): an uncatalogued `eventType` is refused with `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }`; no frame shape changes.

> Amended by decision-0024 and `specs/035-presence/contracts/ws-presence.md`: the optional
> `subscribe.presence` field, the `presence` frame, and the protocol-level heartbeat.
