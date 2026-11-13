---
name: ws-protocol
description: The WebSocket frame shapes (subscribe, send, event, replay-complete, error, the ephemeral narration-stream), the fields the server silently strips from a client's send frame, and the opt-in `presence` field and frame, the heartbeat, and what the protocol deliberately does not provide (acks, typing indicators, a session registry).
kind: concept
sources:
  - apps/server/src/ws/protocol.ts
  - specs/006-ws-gateway/contracts/ws-protocol.md
verified_against: 753a40d24fb9ad9cf5874a29cca6736ed444a8a5
---

# WS protocol

The wire contract for `/ws`, defined with `zod` schemas in `protocol.ts` and frozen as
`specs/006-ws-gateway/contracts/ws-protocol.md` ("binding for TASK-0016 ... changing a frame
shape after 0016 starts is an operator checkpoint, not an implementer decision"). Every frame
is a JSON object with a `type` discriminator; anything that isn't valid JSON or whose `type`
isn't recognized is refused by `parseInboundFrame` and nothing is appended.

## How it works

**Client → server**, both branches of the `InboundFrame` discriminated union:

- `subscribe { sessionId, afterSeq?, presence? }` — join a session and begin replay from `afterSeq`
  (default `0`). Handled by [[replay-live-boundary]]. `presence` is an optional boolean added by
  decision-0024 (TASK-0051): `true` opts the connection in to `presence` frames; absent or
  `false` leaves the stream exactly as before, and a non-boolean value is refused as a validation
  error. The server reads it again on every `subscribe`, so a re-subscribe can change the choice.
- `send { sessionId, eventType, payload, payloadVersion, visibility? }` — a **request** to
  record an event, not the event itself. `SendFrame`'s zod schema deliberately does not
  declare `actor`, `seq`, or `ts`: `z.object` strips unrecognized keys rather than erroring on
  them, so a client that echoes those fields back parses fine but the fields simply never
  reach the handler. A client that could set any of the three could forge history — the
  server's own values (the connection's authenticated identity, and the log's own position
  and timestamp) are authoritative regardless of what a client sends. The gateway classifies a
  `send` by `eventType`: a gate request kind goes to the gate ([[proposal-gate]]; needs
  `payloadVersion` 1 and an object payload); any other catalogued type is refused with an
  `error { kind: "forbidden", code: "CATALOG_TYPE_REQUIRES_GATE" }`; an uncatalogued type is
  refused with `error { kind: "validation", code: "UNKNOWN_EVENT_TYPE" }` and nothing is
  written (TASK-0099, spec 043). The frame shape itself is unchanged.

**Server → client** (guarantee 1, "appended before broadcast", scopes to `event` frames only):

- `event { event: {...} }` — one recorded event, via `toEventPayload`. Used for **both**
  replayed and live delivery, on purpose (same function, called from both `gateway.ts` and
  `subscribe.ts`) — a client that had to distinguish the two would need to track which phase
  it was in, which the boundary algorithm is built specifically so it doesn't need to.
- `replay-complete { throughSeq }` — sent once, after the last replayed event and before live
  delivery. Not required for correctness (ordering already guarantees it); useful to a client
  that wants to distinguish "caught up" from "quiet session."
- `error { kind: "validation" | "forbidden" | "internal", message, code? }` — a refused request.
  The connection stays open. `code` is optional (spec 029 `ws-delivery.md`): present when the
  refusal has a stable code, such as a gate refusal code, `CATALOG_TYPE_REQUIRES_GATE` or
  `UNKNOWN_EVENT_TYPE`.
- `presence { sessionId, present: [{ userId, displayName }] }` — the full set of humans at the
  table, sorted by `userId`, one entry per user. Sent only to a connection whose latest
  `subscribe` had `presence: true`: once right after that subscribe's `replay-complete`, then on
  every change. Never sent to a connection still replaying. A client replaces its set on each
  frame; there are no join or leave deltas. See [[presence]].
- `narration-stream { sessionId, jobId, slot: "rows" | "restate" | "describe" | "ask" | "end", text }`
  — one ephemeral part of the AI DM's in-flight narration (spec 108, TASK-0298; operator C-GATE
  ruling 2026-11-12). It is never appended, never logged and never replayed from the log. The
  server filters it per recipient with `canSee` at `public`, skips a connection still replaying,
  and sends a subscriber the in-flight parts after `replay-complete`. `end` closes a job's
  stream; the settled `narration` event also ends it. `NarrationStreamFrame` is an
  `OutboundFrame` member in `protocol.ts`; the inbound schema is unchanged, so a client cannot
  send one. See [[subscriber-registry]] and [[dm-narration-quality]].

**Heartbeat.** The server pings every connection every 10 s (`HEARTBEAT_INTERVAL_MS`) with a
protocol-level ping, not a frame; a connection that has not answered the previous ping is
terminated. A client's `pong` is automatic in a browser.

## What the protocol deliberately does NOT provide

- **No acknowledgements** — a `send` is confirmed only by its resulting `event` frame arriving
  (which every subscriber, including the sender, receives the same way).
- **No typing indicators or room membership.** Presence was the one exception, added by
  decision-0024 as an opt-in frame (see [[presence]]).
- **No play-session creation or listing** — no session registry exists; a client subscribes to
  an identifier it already knows (see [[m0-demo]]'s D6).
- **No client-side write path**, by construction.

## Connections

Consumed by [[websocket-gateway]] (upgrade + message loop) and [[replay-live-boundary]]
(replay). Mirrored on the client in [[client-session-hook]]'s `types.ts`, which is a hand-kept
copy of this same shape, not a shared import. The frozen contract was amended three times: by
decision-0024, with the `presence` field, frame and heartbeat, by spec 043 (TASK-0099), which
documents the `UNKNOWN_EVENT_TYPE` refusal of an uncatalogued `send`, and by spec 108 (TASK-0298),
which adds the `narration-stream` frame. Only the 108 amendment changes the frame set, additively.

## Operational notes

`seq` may legitimately have gaps for a recipient filtered out of some events — see
[[subscriber-registry]]'s `canSee(viewerFor(...))` filtering. A client must track the *highest* `seq` delivered, not
assume contiguity.
