---
name: server-entrypoint-and-app
description: How index.ts wires config, db, the ingest worker, the Hono app, and the WebSocket gateway onto one server; app.ts's route mount order and why the web middleware is mounted last; and, since TASK-0040, index.ts's STACKS_WEB_DEV-gated Vite middleware-mode wrapper around the same HTTP server. Load for "where does X get wired up" or route-ordering questions.
kind: component
sources:
  - apps/server/src/index.ts
  - apps/server/src/app.ts
  - apps/server/src/routes/dm.ts
verified_against: ce238f2cc6012bc5f971a6197c6b3ade03d23d69
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

Since TASK-0024, `index.ts` then: creates
`uploadDir = path.join(os.tmpdir(), "the-stacks-uploads")` (survives a `restart`, not a
`recreate`, per [[ingestion]]); resolves
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

Since TASK-0046 (specs/031-dm-runtime), `const gate = createGate({ db })` (see
[[proposal-gate]]) is created **before** `createApp`, because the DM runtime needs it:
`missingDmPurposes(aiConfig.purposes)` logs unconfigured `dm.*` purposes by name with
`console.warn`; `startDmWorker({ db, gateway: aiGateway, gate, retrieve, loadProjections,
minSimilarity: answerConfig.minSimilarity })` returns `{ nudge, stop }` (see [[dm-turn-jobs]]);
and `createDmEnqueuer({ db, nudge: dmWorker.nudge, loadProjections, log })` builds the gate
listener. `createApp` receives `dm: { nudge: dmWorker.nudge }`. After `createGateway({ db,
validateSession: createValidateSession(db), gate })` for the WebSocket side, two listeners
register: `gate.onAppended(gateway.publish)` so every row the gate appends reaches the entitled
subscribers, and `gate.onAppended(dmEnqueuer.onAppended)` so a committed action (or a decided
`ai:dm` proposal) queues a DM turn ([[dm-runtime]]).
It calls `serve({ fetch: app.fetch, port: config.port, serverOptions: { requestTimeout: 60 *
60 * 1000 } }, ...)` from `@hono/node-server` — the hour-long `requestTimeout` (`ponytail:`
fixed, not configurable) exists so a large, slow upload isn't cut off mid-stream by Node's
default; the callback logs `Server listening on port ${info.port}`. The load-bearing line is
the last one: `gateway.attach(server)` — the object `serve()` returns is passed directly into
the gateway, so the WebSocket upgrade handler attaches to the **same** underlying Node HTTP
server, not a second listener on a second port. One process, one port, carries the HTTP API,
the ingest and DM workers' background loops, the WebSocket gateway (and the in-process proposal gate), and (via static middleware) the
built client.

`createValidateSession(db)` is called in `createApp` and again for the gateway, both from the
same `db`: HTTP and WebSocket share one session-validation seam ([[session-auth]]).

`app.ts`'s `createApp` takes `{ databaseProbe, db, web?, commit?, library?, dm? }` (`web` is `{
clientRoot?, handler?, listJobs? }`, test-only overrides for the web app's static root, SSR
handler, and jobs reader — this replaced the earlier `staticRoot?` when the app moved to
React Router SSR, TASK-0040; `listJobs` defaults to `(limit) => listJobs(db, limit)` from
`library/ingest/jobs.js`, TASK-0028 plan D2, threaded through to the load context's `jobs()`
— [[client-identity]], [[chat-ui]]; `commit` defaults to
`"unknown"` and is passed straight to `createHealthRoute` — see [[health-check]]; `library`
is `{ uploadMaxBytes?, uploadDir?, onEnqueued?, answer? }`, each falling back to a test-safe
default — 1 GiB, `os.tmpdir()`, a no-op, `undefined` — see [[ingestion]] and, for `answer`
(`Omit<AnswerDeps, "db">`, TASK-0027), [[rules-answerer]]; an absent `answer` makes
`POST /library/ask` stream a single SSE `error` event, `{kind:"config"}`, rather than the
`{error:{kind,...}}` JSON shape [[error-contract]] describes for non-streamed routes; `dm` is
`{ nudge? }`, default a no-op, wired into `createDmRoutes` at `/dm`) and
returns a plain `Hono` app with no port bound. It builds one `identityLookup`
(`createIdentityLookup({ db, validateSession })`, plan D2) shared by `/auth/me` and the web
load context, so the two callers cannot drift. It registers, **in this exact order**:
`app.onError(errorHandler)` / `app.notFound(notFoundHandler)` first, then `app.route("/health",
...)`, `app.route("/api/echo", ...)`, `app.route("/auth", ...)`, `app.route("/library",
createLibraryRoutes(...))` (TASK-0024, [[ingestion]]), `app.route("/dm",
createDmRoutes(...))` (TASK-0046, operator-only, [[dm-runtime]]), and finally `app.use("*",
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
`next()`. `gateway.attach(server)` is unaffected: it attaches to whichever server `serve()` returns.

## Connections

Wires together [[configuration]] (`loadConfig`), [[ai-gateway]] (constructed here, called by
[[ingestion]]'s worker and, since TASK-0027, by [[rules-answerer]]'s `answer()`), [[retrieval]]
(`loadRetrievalConfig`, validated here; `embedPurpose` used by the worker, `retrieve()` itself
now called by `answer()` — [[rules-answerer]]), [[ingestion]] (worker started, `/library` route
mounted), [[dm-runtime]] (DM worker, enqueuer and `/dm` routes), [[rules-answerer]] (`loadAnswerConfig`, validated here; `answerConfig` and the shared
`aiGateway`/`retrievalConfig` threaded into `createApp`'s `library.answer`),
[[error-contract]] (`errorHandler`/`notFoundHandler`), [[static-serving]] (mount-order
guarantee), [[session-auth]] (`createValidateSession` shared by all three: HTTP auth routes,
`/library`, and the socket), and the websocket gateway. See [[overview]] for the "one process,
one port" framing this file implements.

## Operational notes

`createApp` never binds a port — only `index.ts` does, so tests get an in-process app.
