---
name: configuration
description: loadConfig's env-var contract — APP_PORT not PORT, the required DATABASE_URL, and the TEST_DATABASE_URL/DATABASE_URL split between the running server and host-run scripts, including why migrate.ts uses || rather than ??. Load for any env-var or "why did config throw" question.
kind: concept
sources:
  - apps/server/src/config.ts
  - .env.example
  - apps/server/scripts/migrate.ts
verified_against: ba9fcbb4fa3bdc10f8e66f403cdee90a2093f752
---

# Configuration

`apps/server/src/config.ts` exports `loadConfig(env = process.env): ServerConfig`, reading
`DATABASE_URL` (required — throws `"DATABASE_URL environment variable is required"` if unset),
the port the server binds to, and (since [[ai-gateway]]) the optional AI gateway config.
`ServerConfig` is `{ databaseUrl: string, port: number, ai?: AiConfig }`. `ai` is populated by
`ai/config.ts`'s `loadAiConfig(env)` on every call — never `undefined` in practice, since an
AI gateway with no `AI_*` env vars set still yields a valid, empty config (see [[ai-gateway]]).

## How it works

The port variable is **`APP_PORT`, not `PORT`** — there is no fallback to the more common
`PORT` name anywhere in this function. `loadConfig` reads `env.APP_PORT ?? "3000"` (so an
*unset* `APP_PORT` defaults to 3000), converts with `Number(...)`, and throws
`` `APP_PORT must be a positive integer, got "${portRaw}"` `` if the result isn't a positive
integer. `??` is correct here because the only value that should trigger the default is
"unset" (`undefined`) — there's no case where `APP_PORT` is legitimately an empty string.

`loadConfig` itself never reads `TEST_DATABASE_URL` — the running server always connects with
`DATABASE_URL`, full stop. `TEST_DATABASE_URL` only comes into play in code that runs on the
**host** rather than in the container: `apps/server/scripts/migrate.ts` and the
environment-gated integration test suites (see [[test-suite]]). Both prefer
`TEST_DATABASE_URL` over `DATABASE_URL` when present, because `DATABASE_URL` names the
address the way the **app container** reaches Postgres (`@db:5432`, a compose service name)
and a host process can't resolve that name.

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
[[ai-gateway]]). See [[overview]]'s "environment contract" callout for the same
`DATABASE_URL`-vs-`TEST_DATABASE_URL` trap stated at a higher level.

## Operational notes

Required: `DATABASE_URL` (no default; `loadConfig` throws without it). Optional: `APP_PORT`
(default `3000`, must parse to a positive integer), and `AI_PROVIDERS`/`AI_PURPOSES`/`AI_PRICES`
(see [[ai-gateway]]; unset means no model features, not an error). `TEST_DATABASE_URL` is
consulted only by host-run code (`migrate.ts`, integration tests), never by `loadConfig`/the
running server; leaving it unset makes the event-log integration tests skip rather than fail
(per `.env.example`'s comment), which is a silent gap worth checking for, not a passing suite.
