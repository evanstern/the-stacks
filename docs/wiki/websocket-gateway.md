---
name: websocket-gateway
description: The WebSocket gateway's upgrade-time authentication — a socket only ever opens for a valid session, refused upgrades write a bare HTTP status line, and the 401-vs-503 split that keeps a datastore blip from looking like a sign-out.
kind: component
sources:
  - apps/server/src/ws/gateway.ts
verified_against: 7ed16122b2f78b65297508cc3ef69609507d79e9
---

# WebSocket gateway

`createGateway` builds the `/ws` upgrade handler and the in-memory subscriber registry that
sit alongside the HTTP app. It is not a Hono route: `attach(server)` wires an `upgrade`
listener directly onto the `node:http` server that `serve()` returns, so the gateway shares
the app's single port and process rather than running a second listener.

## How it works

`WebSocketServer` is constructed with `noServer: true`, which is what lets authentication run
on the raw upgrade `request` **before** `wss.handleUpgrade` completes the handshake — a
connection is authenticated or it is never opened, never opened-then-closed.

`handleUpgrade` rejects any path other than `/ws`, then reads the session cookie with a tiny
local `readCookie` parser (Hono's `getCookie` needs a `Context`, which the raw upgrade request
doesn't have) and calls `validateSession` (see [[session-auth]]) — the same seam the HTTP auth
routes use. Two outcomes drive `refuseUpgrade`, which writes a bare `HTTP/1.1 <status> ...`
status line and destroys the socket rather than sending any WebSocket frame:

- **401** — no cookie, or `validateSession` returns `null` (invalid/expired session). The
  client should sign in again.
- **503** — `validateSession` **threw**. A thrown error means validation could not be
  performed at all (the datastore is unreachable), which is not the same fact as "signed
  out." Collapsing the two would log a user out on a transient database blip.

Only on success does `wss.handleUpgrade` run, building a `Connection` (see
[[subscriber-registry]]) from the validated identity — `userId` and `role` are captured once,
at upgrade time, and never re-derived per message. The new `Connection` starts with
`sessionId: null`, `pendingQueue: null` and `replayedThroughSeq: 0` (the replay floor
[[replay-live-boundary]] sets on subscribe).

After that, `handleConnection` wires `message`/`close`/`error` listeners. Each inbound frame
is parsed by [[ws-protocol]]'s `parseInboundFrame`; a frame that fails validation gets an
`error` frame back but the connection stays open. A `subscribe` frame delegates entirely to
[[replay-live-boundary]]. A `send` frame is handled inline: `append` (see [[event-log]]) is
called **before** `registry.broadcast` — append validates that the frame carries no `seq` or
`ts`, and the connection's own authenticated `userId` is used as `actor`, never anything the
frame supplied. If `append` throws, nothing ever reaches `broadcast`.

## Connections

Feeds [[subscriber-registry]] with connections and [[event-log]] with appended events. Frame
shapes and the ignored-fields list live in [[ws-protocol]]. Consumed from the client side by
[[client-session-hook]], which uses an `/auth/me` preflight because the browser can't observe
a refused upgrade's status code directly.

## Operational notes

The upgrade handler's own async work is wrapped so a thrown error inside it destroys the
socket rather than crashing the process (`handleUpgrade(...).catch(...)`). A crash inside a
per-message handler sends an `internal` error frame instead of dropping the connection.
