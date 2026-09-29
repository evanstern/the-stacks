---
name: server-entrypoint-and-app
description: How index.ts wires config, db, the Hono app, and the WebSocket gateway onto one server; app.ts's route mount order and why static is mounted last. Load for "where does X get wired up" or route-ordering questions.
kind: component
sources:
  - apps/server/src/index.ts
  - apps/server/src/app.ts
verified_against: 3a8cdcc4582c79a94fd18dcb5a03f09b6b3728c4
---

# Server entrypoint and app

`apps/server/src/index.ts` is the process entrypoint; `apps/server/src/app.ts` builds the
Hono app it serves. The split exists so tests can exercise the configured app in-process
via `createApp` without binding a port.

## How it works

`index.ts` runs, in order: `loadConfig()` (see [[configuration]]), then `loadAiConfig(process.env)`
(from `ai/config.ts`, called directly here rather than through `loadConfig` — see
[[configuration]]'s "no relative imports" note), then constructs the AI gateway (see
[[ai-gateway]]) via `createGateway({ config: aiConfig, sink: logSink })` from `ai/gateway.ts` —
imported under the alias `createAiGateway` to avoid colliding with the WebSocket module's own
`createGateway`. This slice adds no route, so the AI gateway is unused until TASK-0027; with no
`AI_*` env vars set it is inert. Then `createDb(config.databaseUrl)`,
`createApp({ databaseProbe: createDatabaseProbe(config.databaseUrl), db, commit: config.commit })`,
then `createGateway({ db, validateSession: createValidateSession(db) })` for the WebSocket side.
It calls `serve({ fetch: app.fetch, port: config.port }, ...)` from `@hono/node-server`, and
the callback logs `Server listening on port ${info.port}`. The load-bearing line is the last
one: `gateway.attach(server)` — the object `serve()` returns is passed directly into the
gateway, so the WebSocket upgrade handler attaches to the **same** underlying Node HTTP
server, not a second listener on a second port. One process, one port, carries the HTTP API,
the WebSocket gateway, and (via static middleware) the built client.

`createValidateSession(db)` is called twice in this file's transitive call graph — once
inside `createApp` (threaded into the auth routes) and once here for the gateway — both from
the same `db`, so HTTP and WebSocket share one session-validation seam (see
[[session-auth]]).

`app.ts`'s `createApp` takes `{ databaseProbe, db, staticRoot?, commit? }` (`staticRoot` is a
test-only override for the SPA's static root; `commit` defaults to `"unknown"` and is passed
straight to `createHealthRoute` — see [[health-check]]) and returns a plain `Hono` app with no
port bound. It registers, **in this exact order**: `app.onError(errorHandler)` /
`app.notFound(notFoundHandler)` first, then `app.route("/health", ...)`, `app.route("/api/echo",
...)`, `app.route("/auth", ...)`, and finally `app.use("*", createStaticMiddleware(staticRoot))`.
The static middleware is mounted **last** on purpose: it is a catch-all (`"*"`) SPA fallback,
and anything mounted after it would never be reached, so every real route must be registered
before it (see [[static-serving]]). `/ws` never appears in this list — it is not a Hono
route at all; the gateway intercepts it at the HTTP upgrade event, before Hono's own routing
runs.

## Connections

Wires together [[configuration]] (`loadConfig`), [[ai-gateway]] (constructed here, unused this
slice), [[error-contract]] (`errorHandler`/`notFoundHandler`), [[static-serving]] (mount-order
guarantee), [[session-auth]] (`createValidateSession` shared by both transports), and the
websocket gateway. See [[overview]] for the "one process, one port" framing this file
implements.

## Operational notes

`createApp` never calls `serve()` or otherwise binds a port — only `index.ts` does. Any test
importing `createApp` directly gets an in-process, unbound app suitable for request
injection.
