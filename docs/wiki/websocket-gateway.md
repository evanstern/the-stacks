---
name: websocket-gateway
description: The WebSocket gateway — upgrade-time authentication (a socket only opens for a valid session; 401 vs 503), the send-path classification (gate request kinds go to the gate, other catalogued types are refused, uncatalogued types take the legacy append), and publish, which fans gate output out per viewer.
kind: component
sources:
  - apps/server/src/ws/gateway.ts
verified_against: 49c7de2be46b0cf6b94814c4ed0bb1bd4aa20bb7
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
[[replay-live-boundary]]. A `send` frame goes to `handleSend`, which classifies by `eventType`:

- **A gate request kind** (`GATE_REQUEST_KINDS`): requires `payloadVersion` 1 and an object
  payload (else a `validation` error). The gateway builds the request from the payload plus
  `kind` (and `visibility` when sent) and calls `gate.handle` with a human proposer from the
  connection's identity (`userId`, `role`). On success nothing is sent directly: the gate's
  `onAppended` listener calls `publish`. A refusal becomes an `error` frame with the refusal
  `code`; the kind is `forbidden` for `NOT_AUTHORIZED`, `NOT_DM`, `COMMIT_NOT_ALLOWED` and
  `GROUP_SIGNOFF_REQUIRED`, `internal` for `CONFLICT`, otherwise `validation`. See [[proposal-gate]].
- **Any other catalogued type**: refused with `forbidden` and code `CATALOG_TYPE_REQUIRES_GATE`.
- **Uncatalogued types**: the legacy path. `appendUncataloguedEvent` (see [[event-log]]) appends
  **before** `publish`; the connection's own `userId` is the `actor`, never anything the frame
  supplied. If the append throws, nothing is broadcast. TASK-0099 retires this path.

`createGateway` now requires a `gate` option; `index.ts` creates it and wires
`gate.onAppended(gateway.publish)`. The gateway returns `{ attach, registry, publish }`.
`publish(sessionId, events)` broadcasts stored rows in order through [[subscriber-registry]],
which filters per viewer. `sendError` takes an optional `code`.

## Connections

Feeds [[subscriber-registry]] with connections and [[proposal-gate]] with gate requests. Frame
shapes and the ignored-fields list live in [[ws-protocol]]. Consumed from the client side by
[[client-session-hook]], which uses an `/auth/me` preflight because the browser can't observe
a refused upgrade's status code directly.

## Operational notes

The upgrade handler's own async work is wrapped so a thrown error inside it destroys the
socket rather than crashing the process (`handleUpgrade(...).catch(...)`). A crash inside a
per-message handler sends an `internal` error frame instead of dropping the connection.
