---
name: websocket-gateway
description: The WebSocket gateway — upgrade-time authentication (a socket only opens for a valid session; 401 vs 503), the send-path classification (gate request kinds go to the gate; any other type is refused, `CATALOG_TYPE_REQUIRES_GATE` when catalogued and `UNKNOWN_EVENT_TYPE` when not), publish, which fans gate output out per viewer, and its presence duties (join/leave per connection, the heartbeat).
kind: component
sources:
  - apps/server/src/ws/gateway.ts
verified_against: 753a40d24fb9ad9cf5874a29cca6736ed444a8a5
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
at upgrade time, and never re-derived per message. The upgrade also reads the user's `users.display_name` once (falling back to the user id when
the row is missing or the read fails) for the presence list. The new `Connection` starts with
`sessionId: null`, `pendingQueue: null`, `replayedThroughSeq: 0` (the replay floor
[[replay-live-boundary]] sets on subscribe), a random `connId`, `wantsPresence: false` and
`alive: true`.

After that, `handleConnection` wires `message`/`close`/`error` listeners. Each inbound frame
is parsed by [[ws-protocol]]'s `parseInboundFrame`; a frame that fails validation gets an
`error` frame back but the connection stays open. A `subscribe` frame first updates presence, then delegates to
[[replay-live-boundary]]: it `leave`s the connection's previous table, sets `wantsPresence` from
the frame's `presence` flag, and `join`s the new table in the tracker — for every connection,
whether or not it opted in, because the Director's marker counts every human at the table. On
`close` the gateway `leave`s the table. See [[presence]]. A `send` frame goes to `handleSend`, which classifies by `eventType`:

- **A gate request kind** (`GATE_REQUEST_KINDS`, 19 kinds including `floor`): requires `payloadVersion` 1 and an object
  payload (else a `validation` error). The gateway builds the request from the payload plus
  `kind` (and `visibility` when sent) and calls `gate.handle` with a human proposer from the
  connection's identity (`userId`, `role`). On success nothing is sent directly: the gate's
  `onAppended` listener calls `publish`. A refusal becomes an `error` frame with the refusal
  `code`; the kind is `forbidden` for `NOT_AUTHORIZED`, `NOT_DM`, `COMMIT_NOT_ALLOWED` and
  `GROUP_SIGNOFF_REQUIRED`, `NOT_YOUR_ACTOR`, `DM_SEAT_REQUIRED` and `NOT_YOUR_TURN` (spec 102), `internal` for `CONFLICT`, otherwise `validation` (so `FLOOR_NOT_HELD`, `TURN_MOVED` and `NOT_TURN_MODE` arrive as `validation`; the client labels them, [[play-route]]). See [[proposal-gate]].
- **Any other type**: refused, and nothing is written or broadcast. A catalogued type gets
  `forbidden` with code `CATALOG_TYPE_REQUIRES_GATE`; an uncatalogued type gets `validation`
  with code `UNKNOWN_EVENT_TYPE`. TASK-0099 (specs/043-retire-uncatalogued-send) retired the
  legacy uncatalogued append: the gateway has no write path of its own, and every row reaches a
  subscriber through the gate's `onAppended` listener.

**`CONFLICT`.** The gate runs one session's writes one at a time, so in-process `talk` bursts do
not conflict. `internal` / `CONFLICT` now means a writer outside this gate instance appended three
times in a row ([[proposal-gate]]); the gate writes zero rows then. The gateway reports the refusal
and does not retry; the play client labels it ([[play-route]]).

`createGateway` now requires a `gate` option; `index.ts` creates it and wires
`gate.onAppended(gateway.publish)`. The gateway returns `{ attach, registry, publish, streamNarration, close }`; it takes an optional `presence`
tracker (default: a private one) and `heartbeatIntervalMs`.
`publish(sessionId, events)` broadcasts stored rows in order through [[subscriber-registry]],
which filters per viewer. `sendError` takes an optional `code`.

**Narration stream (spec 108).** `streamNarration(sessionId, part)` hands one part from the DM
worker to the registry, which delivers it and buffers it for late joiners ([[subscriber-registry]]).
`index.ts` wires it through a late-bound sink, because the worker is built before the gateway.
Before `publish` broadcasts an `ai:dm` `narration` event it calls `registry.endNarration`, so
every subscriber sees `end` and then the settled row, in that order. The frame is not logged.

## Presence and heartbeat

The gateway subscribes to the tracker's `onChange` and calls `registry.sendPresence` with the
table's sorted snapshot ([[presence]]). A `setInterval` (unref'd, cleared by `close()` and when
the http server closes) pings every open connection, subscribed or not: a connection whose
`alive` is still false is `terminate()`d, which runs the normal close path and starts the grace
window; otherwise `alive` is cleared and a ping sent. A `pong` sets `alive`.

## Connections

Feeds [[subscriber-registry]] with connections and [[proposal-gate]] with gate requests. Frame
shapes and the ignored-fields list live in [[ws-protocol]]. Consumed from the client side by
[[client-session-hook]], which uses an `/auth/me` preflight because the browser can't observe
a refused upgrade's status code directly.

## Operational notes

The upgrade handler's own async work is wrapped so a thrown error inside it destroys the
socket rather than crashing the process (`handleUpgrade(...).catch(...)`). A crash inside a
per-message handler sends an `internal` error frame instead of dropping the connection.
