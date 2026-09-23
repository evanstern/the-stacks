---
name: ws-protocol
description: The WebSocket frame shapes (subscribe, send, event, replay-complete, error), the fields the server silently strips from a client's send frame, and what the protocol deliberately does not provide (acks, presence, a session registry).
kind: concept
sources:
  - apps/server/src/ws/protocol.ts
  - specs/006-ws-gateway/contracts/ws-protocol.md
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# WS protocol

The wire contract for `/ws`, defined with `zod` schemas in `protocol.ts` and frozen as
`specs/006-ws-gateway/contracts/ws-protocol.md` ("binding for TASK-0016 ... changing a frame
shape after 0016 starts is an operator checkpoint, not an implementer decision"). Every frame
is a JSON object with a `type` discriminator; anything that isn't valid JSON or whose `type`
isn't recognized is refused by `parseInboundFrame` and nothing is appended.

## How it works

**Client → server**, both branches of the `InboundFrame` discriminated union:

- `subscribe { sessionId, afterSeq? }` — join a session and begin replay from `afterSeq`
  (default `0`). Handled by [[replay-live-boundary]].
- `send { sessionId, eventType, payload, payloadVersion, visibility? }` — a **request** to
  record an event, not the event itself. `SendFrame`'s zod schema deliberately does not
  declare `actor`, `seq`, or `ts`: `z.object` strips unrecognized keys rather than erroring on
  them, so a client that echoes those fields back parses fine but the fields simply never
  reach the handler. A client that could set any of the three could forge history — the
  server's own values (the connection's authenticated identity, and the log's own position
  and timestamp) are authoritative regardless of what a client sends.

**Server → client**:

- `event { event: {...} }` — one recorded event, via `toEventPayload`. Used for **both**
  replayed and live delivery, on purpose (same function, called from both `gateway.ts` and
  `subscribe.ts`) — a client that had to distinguish the two would need to track which phase
  it was in, which the boundary algorithm is built specifically so it doesn't need to.
- `replay-complete { throughSeq }` — sent once, after the last replayed event and before live
  delivery. Not required for correctness (ordering already guarantees it); useful to a client
  that wants to distinguish "caught up" from "quiet session."
- `error { kind: "validation" | "forbidden" | "internal", message }` — a refused request. The
  connection stays open.

## What the protocol deliberately does NOT provide

- **No acknowledgements** — a `send` is confirmed only by its resulting `event` frame arriving
  (which every subscriber, including the sender, receives the same way).
- **No presence, typing indicators, or room membership.**
- **No play-session creation or listing** — no session registry exists; a client subscribes to
  an identifier it already knows (see [[m0-demo]]'s D6).
- **No client-side write path**, by construction.

## Connections

Consumed by [[websocket-gateway]] (upgrade + message loop) and [[replay-live-boundary]]
(replay). Mirrored on the client in [[client-session-hook]]'s `types.ts`, which is a hand-kept
copy of this same shape, not a shared import.

## Operational notes

`seq` may legitimately have gaps for a recipient filtered out of some events — see
[[subscriber-registry]]'s `isVisible`. A client must track the *highest* `seq` delivered, not
assume contiguity.
