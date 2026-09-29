---
name: server-entrypoint-and-app
description: How index.ts wires config, db, the ingest worker, the Hono app, and the WebSocket gateway onto one server; app.ts's route mount order and why static is mounted last. Load for "where does X get wired up" or route-ordering questions.
kind: component
sources:
  - apps/server/src/index.ts
  - apps/server/src/app.ts
verified_against: 69b6f01a903f1b9189da332b362f2bd3cc601e71
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
`createGateway`. It also calls `loadRetrievalConfig(process.env)` (from `library/retrieve.ts`,
see [[retrieval]]) and, since TASK-0027 (specs/018-rules-answerer), `loadAnswerConfig(process.env)`
(from `library/answer.ts`, see [[rules-answerer]]) — both validated here so a bad `RETRIEVAL_*`
or `ASK_MIN_SIMILARITY` value fails fast at boot, before `aiGateway` exists.

Since TASK-0024 (specs/017-ingestion-pipeline), `index.ts` then: creates
`uploadDir = path.join(os.tmpdir(), "the-stacks-uploads")` (`mkdirSync(..., {recursive:
true})` — survives a container `restart`, not a `recreate`, per [[ingestion]]); resolves
`embedPurpose` from `retrievalConfig.embedPurpose`, only when `aiConfig.purposes[name]?.op ===
"embed"`, else `null`; and starts `startIngestWorker({ db, gateway: aiGateway, embedPurpose,
uploadDir })` (see [[ingestion]]), which returns `{ nudge, stop }`. `createDb(config.databaseUrl)`
runs before this. `createApp({ databaseProbe, db, commit, library: { uploadMaxBytes:
config.uploadMaxBytes, uploadDir, onEnqueued: ingestWorker.nudge, answer: { gateway: aiGateway,
retrieval: retrievalConfig, config: answerConfig } } })` wires the upload route's size ceiling,
its temp-file directory, a callback that wakes the worker's poll loop the instant a job is
enqueued rather than waiting up to `POLL_MS`, and (TASK-0027) `POST /library/ask`'s three
dependencies — the same `aiGateway` and `retrievalConfig` constructed above, reused rather than
built twice. Then
`createGateway({ db, validateSession: createValidateSession(db) })` for the WebSocket side.
It calls `serve({ fetch: app.fetch, port: config.port, serverOptions: { requestTimeout: 60 *
60 * 1000 } }, ...)` from `@hono/node-server` — the hour-long `requestTimeout` (`ponytail:`
fixed, not configurable) exists so a large, slow upload isn't cut off mid-stream by Node's
default; the callback logs `Server listening on port ${info.port}`. The load-bearing line is
the last one: `gateway.attach(server)` — the object `serve()` returns is passed directly into
the gateway, so the WebSocket upgrade handler attaches to the **same** underlying Node HTTP
server, not a second listener on a second port. One process, one port, carries the HTTP API,
the ingest worker's background loop, the WebSocket gateway, and (via static middleware) the
built client.

`createValidateSession(db)` is called twice in this file's transitive call graph — once
inside `createApp` (threaded into the auth routes) and once here for the gateway — both from
the same `db`, so HTTP and WebSocket share one session-validation seam (see
[[session-auth]]).

`app.ts`'s `createApp` takes `{ databaseProbe, db, staticRoot?, commit?, library? }`
(`staticRoot` is a test-only override for the SPA's static root; `commit` defaults to
`"unknown"` and is passed straight to `createHealthRoute` — see [[health-check]]; `library`
is `{ uploadMaxBytes?, uploadDir?, onEnqueued?, answer? }`, each falling back to a test-safe
default — 1 GiB, `os.tmpdir()`, a no-op, `undefined` — see [[ingestion]] and, for `answer`
(`Omit<AnswerDeps, "db">`, TASK-0027), [[rules-answerer]]; an absent `answer` makes
`POST /library/ask` stream a single SSE `error` event, `{kind:"config"}`, rather than the
`{error:{kind,...}}` JSON shape [[error-contract]] describes for non-streamed routes) and
returns a plain `Hono` app with no port bound. It registers, **in this exact order**: `app.onError(errorHandler)` /
`app.notFound(notFoundHandler)` first, then `app.route("/health", ...)`, `app.route("/api/echo",
...)`, `app.route("/auth", ...)`, `app.route("/library", createLibraryRoutes(...))` (TASK-0024,
[[ingestion]]), and finally `app.use("*", createStaticMiddleware(staticRoot))`.
The static middleware is mounted **last** on purpose: it is a catch-all (`"*"`) SPA fallback,
and anything mounted after it would never be reached, so every real route must be registered
before it (see [[static-serving]]). `/ws` never appears in this list — it is not a Hono
route at all; the gateway intercepts it at the HTTP upgrade event, before Hono's own routing
runs.

## Connections

Wires together [[configuration]] (`loadConfig`), [[ai-gateway]] (constructed here, called by
[[ingestion]]'s worker and, since TASK-0027, by [[rules-answerer]]'s `answer()`), [[retrieval]]
(`loadRetrievalConfig`, validated here; `embedPurpose` used by the worker, `retrieve()` itself
now called by `answer()` — [[rules-answerer]]), [[ingestion]] (worker started, `/library` route
mounted), [[rules-answerer]] (`loadAnswerConfig`, validated here; `answerConfig` and the shared
`aiGateway`/`retrievalConfig` threaded into `createApp`'s `library.answer`),
[[error-contract]] (`errorHandler`/`notFoundHandler`), [[static-serving]] (mount-order
guarantee), [[session-auth]] (`createValidateSession` shared by all three: HTTP auth routes,
`/library`, and the socket), and the websocket gateway. See [[overview]] for the "one process,
one port" framing this file implements.

## Operational notes

`createApp` never calls `serve()` or otherwise binds a port — only `index.ts` does. Any test
importing `createApp` directly gets an in-process, unbound app suitable for request
injection.
