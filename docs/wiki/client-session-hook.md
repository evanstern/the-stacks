---
name: client-session-hook
description: useSession's reconnect algorithm — subscribing with afterSeq tracked via Math.max, one code path for replayed and live events, no optimistic send, and the /auth/me preflight that stands in for a refused upgrade's unobservable HTTP status. Takes an onSignedOut callback instead of writing a TanStack Query cache. Opts in to presence frames (TASK-0051). Every inbound frame goes through the pure reduceFrame, refusals set a notice, and sendEvent sends gate-request frames.
kind: pattern
sources:
  - apps/web/app/ws/useSession.ts
  - apps/web/app/ws/types.ts
  - apps/web/app/routes/play.tsx
  - apps/web/app/play/reduce-frame.ts
verified_against: 68115fdd4cca3cfcb41f7052b408fd2eef27b9cd
---

# Client session hook

`useSession(sessionId, onSignedOut)` returns `{ events, status, caughtUp, notice, present, sendEvent, resync }`
and is the client half of [[replay-live-boundary]]: it opens the socket,
tracks the events it's been shown, and reconnects on drop. `types.ts` is a hand-kept mirror of
[[ws-protocol]]'s `RecordedEvent`/`ServerFrame` shapes — not a shared import from the server
package, so a frame-shape change has to be caught, not inferred.

## How it works

`highestSeqRef` holds the highest `seq` ever delivered, updated on every `event` frame as
`Math.max(highestSeqRef.current, frame.event.seq)` — **never incremented** to guess a "next
expected" value. Because [[subscriber-registry]]'s per-viewer `canSee` filtering means `seq` can
legitimately skip values for this connection, treating a gap as "missing" and incrementing
would be wrong; `Math.max` is the only operation that's safe regardless of gaps. This ref is
sent verbatim as `afterSeq` on every `subscribe` frame, including reconnects.

**Replayed and live events go through one path.** The `message` listener has no notion of
"replay phase" — every frame is folded by `play/reduce-frame.ts`'s `reduceFrame` into
`FrameState` (`events`, `highestSeq`, `caughtUp`, `notice`, `present`), and an `event` frame also updates
`highestSeqRef`, whether it arrived before or after `replay-complete`. `replay-complete` only
flips `caughtUp`, which the table view uses to show/hide a loading message; it's not
load-bearing for correctness, matching [[ws-protocol]]'s note that the frame exists for UX,
not ordering. A `presence` frame replaces `present` (the hook sends `presence: true` on every
`subscribe`; `types.ts` mirrors `PresenceEntry`, `SubscribeFrame` and the `presence` frame), and
the hook resets `present` to `null` when the socket closes — a dead connection says nothing about
who is at the table, and the next subscribe brings a fresh snapshot. `reduceFrame` has a
`default` branch that returns the state unchanged, so a frame type the client does not know is
ignored rather than throwing ([[presence]]). An `error` frame sets `notice` to `message (code)` (the optional `code` is the
gate's refusal code; for the three floor refusals `FLOOR_NOT_HELD`, `TURN_MOVED` and `NOT_TURN_MODE` the message is replaced by `labels.ts`'s plain wording) and never closes the socket (FR-015); see [[play-route]].

**Reconnect uses a preflight, not a raw retry.** Before opening a new `WebSocket`, `attempt()`
calls `GET /auth/me`. This exists because **the browser `WebSocket` API never exposes the HTTP
status of a refused upgrade** — by spec, a non-`101` response just fails the connection with a
generic `close` (code `1006`, empty reason), so a page script can't use WebSocket connect
failures to port-scan. [[websocket-gateway]]'s `401`/`503` split is otherwise invisible to the
client. `/auth/me` exercises the identical `validateSession` seam the upgrade does and *does*
expose its status, so it stands in as the oracle: a `401` calls the hook's `onSignedOut`
callback (bouncing to sign-in, same effect as [[client-identity]]'s normal flow, but reached
by forcing a loader revalidation rather than writing a client cache — `useLiveTable` passes
`revalidator.revalidate` as this callback); anything else that isn't `ok` schedules a retry
after `RETRY_DELAY_MS` (1000ms) without touching identity — a datastore blip must not sign
anyone out.

**No optimistic rendering.** `sendEvent(frame)` takes `{ eventType, payload, payloadVersion,
visibility? }`, wraps it in a `send` frame carrying only permitted fields (never actor, seq or
ts), puts it on the wire and stops (it returns false when the socket is not open); the message a user sends only appears in `events` once its own
`event` frame comes back over the socket, exactly like everyone else's. This mirrors
[[websocket-gateway]]'s append-before-broadcast: nothing is shown that isn't confirmed
recorded.

**Resync on a seat gain.** `resync()` (TASK-0177, specs/062) is for a user who has just gained the
DM seat: the server filters per viewer, so the events the client already holds were filtered for
the old seat. It returns without effect unless the socket is open; otherwise it resets the frame
state, sets `highestSeqRef` to 0 and sends a fresh `subscribe` with `afterSeq: 0` and `presence: true`
on the same socket. The server replays under the new seat. `useLiveTable` calls it once, when
`shouldResync` ([[play-route]]) sees `isDm` flip after replay.

## Connections

Drives against [[websocket-gateway]] and [[replay-live-boundary]] server-side; its
`onSignedOut` callback is wired to the same revalidation path [[client-identity]] describes.
Consumed by `useLiveTable` in [[play-route]], behind the `play/:sessionId` route in
[[react-router-app]]'s route tree, which is also the surface [[m0-demo]] exercises.

## Operational notes

On unmount or `sessionId` change, the effect's cleanup sets a `stopped` flag, clears any
pending retry timer, and closes the socket — a stale `attempt()` in flight checks `stopped`
before acting on its result so it can't resurrect a connection for a session the component has
left.
