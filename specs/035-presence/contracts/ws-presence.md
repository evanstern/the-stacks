# Contract: ws-protocol amendment — presence (decision-0024)

Amends `specs/006-ws-gateway/contracts/ws-protocol.md`. Every other frame is unchanged.

## `subscribe` (client → server)

```json
{ "type": "subscribe", "sessionId": "<uuid>", "afterSeq": 0, "presence": true }
```

- `presence` is optional. Absent or `false` means the stream is exactly today's.
- An older server strips the key; the client then receives no `presence` frame.

## `presence` (server → client)

```json
{
  "type": "presence",
  "sessionId": "<uuid>",
  "present": [{ "userId": "<uuid>", "displayName": "Ana" }]
}
```

- Sent only to a connection whose latest `subscribe` had `presence: true`.
- Sent once right after that subscribe's `replay-complete`, then on every change to the set.
- Never sent to a connection still replaying; it gets its snapshot after `replay-complete`.
- `present` is a full snapshot, sorted by `userId`, humans only, one entry per user. No role.
- No join or leave deltas. A client replaces its set on each frame.

## Heartbeat

The server sends a protocol-level ping every `HEARTBEAT_INTERVAL_MS`. A connection that has not
answered the previous ping is terminated. No frame is involved.

## Client obligations

- `reduceFrame` ignores any frame `type` it does not know.
- The marker event `presence.recorded` arrives as an ordinary `event` frame.
