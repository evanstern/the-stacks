---
name: server-entrypoint-and-app
description: How index.ts wires config, db, the ingest worker, the Hono app, and the WebSocket gateway onto one server; app.ts's route mount order and why the web middleware is mounted last; and, since TASK-0040, index.ts's STACKS_WEB_DEV-gated Vite middleware-mode wrapper around the same HTTP server. Load for "where does X get wired up" or route-ordering questions.
kind: component
sources:
  - apps/server/src/index.ts
  - apps/server/src/app.ts
  - apps/server/src/routes/dm.ts
  - apps/server/src/routes/tables.ts
  - apps/server/src/dm/script/env.ts
verified_against: beae54aa70dd2338a46f33de801f38e0019624b6
---

# Server entrypoint and app

`apps/server/src/index.ts` is the process entrypoint; `apps/server/src/app.ts` builds the
Hono app it serves. The split exists so tests can exercise the configured app in-process
via `createApp` without binding a port.

## How it works

`index.ts` runs, in order: `loadConfig()` (see [[configuration]]), then `createAiRuntime(process.env)`
(from `dm/script/env.ts`, TASK-0158, specs/053), which calls `loadAiConfig` directly (not through
`loadConfig`; see [[configuration]]) or, when `DM_FAKE_SCRIPT` is
set, builds script mode ([[ai-gateway]]) and `index.ts` logs `DM script mode: <name> (<n> calls, <n> dice)`.
It then constructs the AI gateway via `createGateway({ config: aiConfig, sink: logSink, adapters:
runtime.adapters })` from `ai/gateway.ts`, imported as `createAiGateway` to avoid colliding with the
WebSocket module's own `createGateway`. It also calls `loadRetrievalConfig(process.env)` (from `library/retrieve.ts`,
see [[retrieval]]) and, since TASK-0027 (specs/018-rules-answerer), `loadAnswerConfig(process.env)`
(from `library/answer.ts`, see [[rules-answerer]]) — both validated here so a bad `RETRIEVAL_*`
or `ASK_MIN_SIMILARITY` value fails fast at boot, before `aiGateway` exists.

Since TASK-0024, `index.ts` then: creates
`uploadDir = path.join(os.tmpdir(), "the-stacks-uploads")` ([[ingestion]]); resolves
`embedPurpose` from `retrievalConfig.embedPurpose`, only when `aiConfig.purposes[name]?.op ===
"embed"`, else `null`; and starts `startIngestWorker({ db, gateway: aiGateway, embedPurpose,
uploadDir })` (see [[ingestion]]), which returns `{ nudge, stop }`. `createDb(config.databaseUrl)`
runs before this. `createApp({ databaseProbe, db, commit, library: { uploadMaxBytes:
config.uploadMaxBytes, uploadDir, onEnqueued: ingestWorker.nudge, answer: { gateway: aiGateway,
retrieval: retrievalConfig, config: answerConfig } } })` wires the upload route's size ceiling,
its temp-file directory, a callback that wakes the worker's poll loop the instant a job is
enqueued rather than waiting up to `POLL_MS`, and (TASK-0027) `POST /library/ask`'s three
dependencies — the same `aiGateway` and `retrievalConfig` constructed above, reused rather than
built twice.

Since TASK-0046, `createGate({ db, presence: presence.reader, rng: runtime.gateRng })` (see
[[proposal-gate]]; `rng` is set only in script mode) is created **before** `createApp`, because the DM runtime needs it:
`missingDmPurposes(aiConfig.purposes)` logs unconfigured `dm.*` purposes by name with
`console.warn`, and `unstructuredDmPurposes` warns once; `startDmWorker({ db, presence: presence.reader, gateway: aiGateway, gate, retrieve, loadProjections,
minSimilarity: answerConfig.minSimilarity })` returns `{ nudge, stop }` (see [[dm-turn-jobs]]);
and `createDmEnqueuer({ db, nudge: dmWorker.nudge, loadProjections, presence: presence.reader, log })` builds the gate
listener. `createApp` receives `dm: { nudge: dmWorker.nudge }`. After `createGateway({ db, validateSession, gate, presence })` for the WebSocket side, two listeners
register: `gate.onAppended(gateway.publish)` so every row the gate appends reaches the entitled
subscribers, and `gate.onAppended(dmEnqueuer.onAppended)` so a committed action (or a decided
`ai:dm` proposal) queues a DM turn ([[dm-runtime]]); `presence.reader.onChange` calls `dmEnqueuer.onPresenceChange` ([[turn-floor]]).
It calls `serve({ fetch: app.fetch, port: config.port, serverOptions: { requestTimeout: 60 *
60 * 1000 } }, ...)` from `@hono/node-server` — the hour-long `requestTimeout` (`ponytail:`
fixed, not configurable) exists so a large, slow upload isn't cut off mid-stream by Node's
default; the callback logs `Server listening on port ${info.port}`. The load-bearing line is
the last one: `gateway.attach(server)` — the object `serve()` returns is passed directly into
the gateway, so the WebSocket upgrade handler attaches to the **same** Node HTTP
server, not a second port. One process, one port, carries the HTTP API,
the ingest and DM workers' loops, the WebSocket gateway (and the in-process gate), and (via static middleware) the
built client.

`createValidateSession(db)` is called in `createApp` and again for the gateway: one session-validation seam ([[session-auth]]).

`app.ts`'s `createApp` takes `{ databaseProbe, db, web?, commit?, library?, dm? }` (`web` is `{
clientRoot?, handler?, listJobs? }`, test-only overrides for the web app's static root, SSR
handler, and jobs reader, threaded to the load context's `jobs()` — [[client-identity]], [[chat-ui]]; `commit` defaults to
`"unknown"` and is passed straight to `createHealthRoute` — see [[health-check]]; `library`
is `{ uploadMaxBytes?, uploadDir?, onEnqueued?, answer? }`, each falling back to a test-safe
default — 1 GiB, `os.tmpdir()`, a no-op, `undefined` — see [[ingestion]] and, for `answer`
(`Omit<AnswerDeps, "db">`, TASK-0027), [[rules-answerer]]; an absent `answer` makes
`POST /library/ask` stream a single SSE `error` event, `{kind:"config"}`, rather than the
`{error:{kind,...}}` JSON shape [[error-contract]] describes for non-streamed routes; `dm` is
`{ nudge? }`, default a no-op, wired into `createDmRoutes` at `/dm`, plus [[debug-view]] routes) and
returns a plain `Hono` app with no port bound. It builds one `identityLookup`
(`createIdentityLookup({ db, validateSession })`, plan D2) shared by `/auth/me` and the web
load context, so the two callers cannot drift. It registers, **in this exact order**:
`app.onError(errorHandler)` / `app.notFound(notFoundHandler)` first, then `app.route("/health",
...)`, `app.route("/api/echo", ...)`, `app.route("/api/tables", createTablesRoute({ db, validateSession }))` (TASK-0175), `app.route("/auth", ...)`, `app.route("/library",
createLibraryRoutes(...))` (TASK-0024, [[ingestion]]), `app.route("/dm",
createDmRoutes(...))` (TASK-0046, operator-only, [[dm-runtime]]; since TASK-0163 it also serves `GET /dm/seeds` and refuses a start that seats one user twice), and finally `app.use("*",
createWebMiddleware({ clientRoot: web?.clientRoot, handler: web?.handler, lookup:
identityLookup, listJobs: web?.listJobs ?? ((limit) => listJobs(db, limit)) }))`. The web
middleware is mounted **last** on purpose: it is a catch-all
(`"*"`) fallback ending in a full SSR render, so every real route must be registered before it
(see [[static-serving]]). `/ws` is not a Hono route: the gateway intercepts it at the HTTP upgrade.

**Dev mode (TASK-0040), gated by `STACKS_WEB_DEV=1`.** Only behind that env var does `index.ts`
dynamically import `web-dev.js` (which imports `vite`, so production never loads it). When set,
`createApp` gets `web: { handler: webDev.handler }` (Vite serves the SSR module per request) and
`serve()` gets a custom `createServer` wrapper: a plain `node:http` listener that checks
`isReservedPath` ([[static-serving]]) first — a reserved request goes straight to Hono; the rest
runs through `webDev.middlewares` (Vite middleware mode), which falls through to Hono via
`next()`. `gateway.attach(server)` attaches to whichever server `serve()` returns.

## Connections

Wires together [[configuration]] (`loadConfig`), [[ai-gateway]] (constructed here, called by
[[ingestion]]'s worker and, since TASK-0027, by [[rules-answerer]]'s `answer()`), [[retrieval]]
(`loadRetrievalConfig`, validated here; `embedPurpose` used by the worker, `retrieve()` itself
now called by `answer()` — [[rules-answerer]]), [[ingestion]] (worker started, `/library` route
mounted), [[dm-runtime]] (DM worker, enqueuer and `/dm` routes), [[rules-answerer]] (`loadAnswerConfig`, validated here; `answerConfig` and the shared
`aiGateway`/`retrievalConfig` threaded into `createApp`'s `library.answer`),
[[error-contract]] (`errorHandler`/`notFoundHandler`), [[static-serving]] (mount-order
guarantee), [[session-auth]] (`createValidateSession`), and the websocket gateway. See [[overview]].

## Operational notes

`createApp` never binds a port; only `index.ts` does.
