---
name: client-session-hook
description: useSession's reconnect algorithm — subscribing with afterSeq tracked via Math.max, one code path for replayed and live events, no optimistic send, and the /auth/me preflight that stands in for a refused upgrade's unobservable HTTP status. Moved unchanged into the React Router app except for one seam — it now takes an onSignedOut callback instead of writing a TanStack Query cache directly.
kind: pattern
sources:
  - apps/web/app/ws/useSession.ts
  - apps/web/app/ws/types.ts
  - apps/web/app/routes/play.tsx
verified_against: a82067ceb8794332fc5106885fadc185f1c34c7b
---

# Client session hook

`useSession(sessionId, onSignedOut)` is the client half of [[replay-live-boundary]]: it opens the socket,
tracks the events it's been shown, and reconnects on drop. `types.ts` is a hand-kept mirror of
[[ws-protocol]]'s `RecordedEvent`/`ServerFrame` shapes — not a shared import from the server
package, so a frame-shape change has to be caught, not inferred.

## How it works

`highestSeqRef` holds the highest `seq` ever delivered, updated on every `event` frame as
`Math.max(highestSeqRef.current, frame.event.seq)` — **never incremented** to guess a "next
expected" value. Because [[subscriber-registry]]'s `isVisible` filtering means `seq` can
legitimately skip values for this connection, treating a gap as "missing" and incrementing
would be wrong; `Math.max` is the only operation that's safe regardless of gaps. This ref is
sent verbatim as `afterSeq` on every `subscribe` frame, including reconnects.

**Replayed and live events go through one path.** The `message` listener has no notion of
"replay phase" — every `event` frame updates `highestSeqRef` and appends to `events` state the
same way, whether it arrived before or after `replay-complete`. `replay-complete` only flips a
`caughtUp` flag `PlayView` uses to show/hide a loading message; it's not load-bearing for
correctness, matching [[ws-protocol]]'s note that the frame exists for UX, not ordering.

**Reconnect uses a preflight, not a raw retry.** Before opening a new `WebSocket`, `attempt()`
calls `GET /auth/me`. This exists because **the browser `WebSocket` API never exposes the HTTP
status of a refused upgrade** — by spec, a non-`101` response just fails the connection with a
generic `close` (code `1006`, empty reason), so a page script can't use WebSocket connect
failures to port-scan. [[websocket-gateway]]'s `401`/`503` split is otherwise invisible to the
client. `/auth/me` exercises the identical `validateSession` seam the upgrade does and *does*
expose its status, so it stands in as the oracle: a `401` calls the hook's `onSignedOut`
callback (bouncing to sign-in, same effect as [[client-identity]]'s normal flow, but reached
by forcing a loader revalidation rather than writing a client cache — `play.tsx` passes
`revalidator.revalidate` as this callback); anything else that isn't `ok` schedules a retry
after `RETRY_DELAY_MS` (1000ms) without touching identity — a datastore blip must not sign
anyone out.

**No optimistic rendering.** `send()` in the hook, and the submit handler in `play.tsx`, put a
frame on the wire and stop; the message a user sends only appears in `events` once its own
`event` frame comes back over the socket, exactly like everyone else's. This mirrors
[[websocket-gateway]]'s append-before-broadcast: nothing is shown that isn't confirmed
recorded.

## Connections

Drives against [[websocket-gateway]] and [[replay-live-boundary]] server-side; its
`onSignedOut` callback is wired to the same revalidation path [[client-identity]] describes.
Consumed by the `play/:sessionId` route in [[react-router-app]]'s route tree, which is also
the surface [[m0-demo]] exercises.

## Operational notes

On unmount or `sessionId` change, the effect's cleanup sets a `stopped` flag, clears any
pending retry timer, and closes the socket — a stale `attempt()` in flight checks `stopped`
before acting on its result so it can't resurrect a connection for a session the component has
left.
