---
name: configuration
description: loadConfig's env-var contract — APP_PORT not PORT, the required DATABASE_URL, UPLOAD_MAX_BYTES, and the TEST_DATABASE_URL/DATABASE_URL split between the running server and host-run scripts, including why migrate.ts uses || rather than ??. Load for any env-var or "why did config throw" question.
kind: concept
sources:
  - apps/server/src/config.ts
  - .env.example
  - apps/server/scripts/migrate.ts
  - apps/server/scripts/create-operator.ts
  - package.json
verified_against: 788261d9152946f53780d3750d5419d901e029e5
---

# Configuration

`apps/server/src/config.ts` exports `loadConfig(env = process.env): ServerConfig`, reading
four things: `DATABASE_URL` (required — throws `"DATABASE_URL environment variable is
required"` if unset), the port the server binds to, `GIT_COMMIT` (optional, `"unknown"` if
unset — surfaced at `/health`, see [[health-check]]), and, since TASK-0024
(specs/017-ingestion-pipeline), `UPLOAD_MAX_BYTES`. `ServerConfig` is `{ databaseUrl: string,
port: number, commit: string, uploadMaxBytes: number }`.

**`config.ts` has no relative imports, on purpose.** `apps/server/scripts/migrate.ts` and
`apps/server/scripts/create-operator.ts` run it on the host under
`node --experimental-strip-types`, which cannot follow `src/`'s `.js`-suffixed imports (see
below) — so `config.ts` must never import another `src/` module. The AI gateway config (see
[[ai-gateway]]) is loaded separately, by `index.ts`'s `loadAiConfig(env)`, precisely to keep
this file clean; `check:host-scripts` (root `package.json`, run as part of `ci:check`) enforces
it by actually importing `config.ts` (and the other scripts' direct dependencies) the same way
the scripts do, catching a reintroduced relative import before it reaches CI's `db:migrate`
step.

## How it works

The port variable is **`APP_PORT`, not `PORT`** — there is no fallback to the more common
`PORT` name anywhere in this function. `loadConfig` reads `env.APP_PORT ?? "3000"` (so an
*unset* `APP_PORT` defaults to 3000), converts with `Number(...)`, and throws
`` `APP_PORT must be a positive integer, got "${portRaw}"` `` if the result isn't a positive
integer. `??` is correct here because the only value that should trigger the default is
"unset" (`undefined`) — there's no case where `APP_PORT` is legitimately an empty string.

`uploadMaxBytes` is `Number(env.UPLOAD_MAX_BYTES ?? "1073741824")` (1 GiB default), validated
the same way as `APP_PORT` — throws `` `UPLOAD_MAX_BYTES must be a positive integer, got
"${raw}"` `` for anything that isn't a positive integer. It ceilings a single upload's file
part in [[ingestion]]'s `/library/uploads` route; see that note for how the route enforces it
both from `Content-Length` and mid-stream.

`commit` is `env.GIT_COMMIT ?? "unknown"` — no validation, since any string (or its absence)
is a legitimate answer. It is baked into the image at build time (spec 010's `GIT_COMMIT`
build arg; see [[container-image]] and [[compose-stack]]), not read from `.env`, so it is the
one `ServerConfig` field a plain `docker compose up` and an `env.mjs`-managed stack can
legitimately disagree on.

`loadConfig` itself never reads `TEST_DATABASE_URL` — the running server always connects with
`DATABASE_URL`, full stop. `TEST_DATABASE_URL` only comes into play in code that runs on the
**host** rather than in the container: `apps/server/scripts/migrate.ts`,
`create-operator.ts`, and the environment-gated integration test suites (see [[test-suite]]).
Both prefer `TEST_DATABASE_URL` over `DATABASE_URL` when present, because `DATABASE_URL`
names the address the way the **app container** reaches Postgres (`@db:5432`, a compose
service name) and a host process can't resolve that name.

Since spec 020, `TEST_DATABASE_URL` names a **separate, throwaway database** — its own
per-worktree `docker-compose.test.yml` stack ([[runtime-stacks]]), not a host-reachable view
of the app's own `DATABASE_URL` database. One consequence worth knowing: because
`migrate.ts`/`create-operator.ts` prefer it, a bare `pnpm db:migrate` run from the host now
migrates the **test** database — which is what the test suites need, but not what a
developer reaching for "migrate my app database" from muscle memory expects. Migrating the
app database from the host takes an explicit one-command override (`.env.example`,
research R7):
`TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db> pnpm --filter
@the-stacks/server db:migrate`.

`migrate.ts` does this with `process.env.TEST_DATABASE_URL || config.databaseUrl` —
**`||`, not `??`, and this is deliberate.** `docker-compose.yml` blanks `TEST_DATABASE_URL`
to `""` inside the `app` container (see [[compose-stack]]) precisely so this expression falls
through to `config.databaseUrl`. `""` is falsy, so `||` treats it as "not usefully set" and
skips it; `??` only checks for `null`/`undefined` and would have kept the empty string,
handing `createDb` an empty connection string and breaking migrations run inside the
container. Outside the container, on a host with `.env`'s `TEST_DATABASE_URL` uncommented,
the same `||` picks it up normally.

`migrate.ts` also documents why it imports with `.ts` extensions
(`../src/config.ts`/`../src/db.ts`) rather than the `.js`-suffixed imports `src/` uses
internally: it runs directly via Node's native TypeScript stripping (per its `package.json`
script), not through the `tsc`-built `dist/`, so it can't use the bundler-resolved `.js`
suffixes the compiled server code needs.

## Connections

Read by [[server-entrypoint-and-app]] (`index.ts` calls `loadConfig()` once, unconditionally)
and by [[compose-stack]]'s env-var contract. `.env.example` is the template `docker-compose.yml`
and this file both assume, and now also documents the AI gateway's three env vars (see
[[ai-gateway]]), retrieval's three (see [[retrieval]]), and (TASK-0027) answering's one,
`ASK_MIN_SIMILARITY` (see [[rules-answerer]]). See [[overview]]'s "environment
contract" callout for the same
`DATABASE_URL`-vs-`TEST_DATABASE_URL` trap stated at a higher level.

## Operational notes

Required: `DATABASE_URL` (no default; `loadConfig` throws without it). Optional: `APP_PORT`
(default `3000`, must parse to a positive integer), `GIT_COMMIT` (default `"unknown"`, set via
the Dockerfile build arg, never from `.env`), `UPLOAD_MAX_BYTES` (default `1073741824`, must
parse to a positive integer). `AI_PROVIDERS`/`AI_PURPOSES`/`AI_PRICES` are read
by `index.ts` via `ai/config.ts`'s `loadAiConfig`, not by `loadConfig` itself (see
[[ai-gateway]]; unset means no model features, not an error). `RETRIEVAL_MODE`/`RETRIEVAL_K`/
`RETRIEVAL_EMBED_PURPOSE` are the same shape — optional, Zod-validated by `library/retrieve.ts`'s
`loadRetrievalConfig`, also called by `index.ts` rather than `loadConfig` (see [[retrieval]]).
`ASK_MIN_SIMILARITY` (TASK-0027) is the same shape again — optional (default `0.3`),
Zod-validated by `library/answer.ts`'s `loadAnswerConfig`, also called by `index.ts` (see
[[rules-answerer]]). `TEST_DATABASE_URL` (and its port, `TEST_DB_PORT`, default `5433`) is consulted
only by host-run code (`migrate.ts`, integration tests), never by `loadConfig`/the running
server; leaving it unset makes the event-log integration tests skip rather than fail (per
`.env.example`'s comment), which is a silent gap worth checking for, not a passing suite.
`pnpm env:up` derives and writes both.
