---
name: configuration
description: loadConfig's env-var contract — APP_PORT not PORT, the required DATABASE_URL, UPLOAD_MAX_BYTES, the optional DM_FAKE_SCRIPT guard, the TEST_DATABASE_URL/DATABASE_URL split between the running server and host-run scripts (why migrate.ts uses || rather than ??), and where secrets/shared keys (AI_PROVIDERS, AI_PURPOSES, API keys) actually live — the root checkout's .env, not each worktree's. Load for any env-var, "why did config throw", or "where do I put my API key" question.
kind: concept
sources:
  - apps/server/src/config.ts
  - .env.example
  - apps/server/src/dm/script/env.ts
  - apps/server/scripts/migrate.ts
  - apps/server/src/cli/create-operator.ts
  - package.json
verified_against: 89d75e2dab43df6326d00177af7c11bd46efe14b
---

# Configuration

`apps/server/src/config.ts` exports `loadConfig(env = process.env): ServerConfig`, reading
four things: `DATABASE_URL` (required — throws `"DATABASE_URL environment variable is
required"` if unset), the port the server binds to, `GIT_COMMIT` (optional, `"unknown"` if
unset — surfaced at `/health`, see [[health-check]]), and, since TASK-0024
(specs/017-ingestion-pipeline), `UPLOAD_MAX_BYTES`. `ServerConfig` is `{ databaseUrl: string,
port: number, commit: string, uploadMaxBytes: number }`.

**`config.ts` has no relative imports, on purpose.** `apps/server/scripts/migrate.ts` runs it
on the host under `node --experimental-strip-types`, which cannot follow `src/`'s
`.js`-suffixed imports (see below) — so `config.ts` must never import another `src/` module.
The AI gateway config (see
[[ai-gateway]]) is loaded separately, by `index.ts` (through `createAiRuntime`, which calls `loadAiConfig(env)`), precisely to keep
this file clean; `check:host-scripts` (part of `ci:check`) enforces
it by importing `config.ts` and `db.ts` the way `migrate.ts` does.

## How it works

The port variable is **`APP_PORT`, not `PORT`**, with no `PORT` fallback. `loadConfig` reads `env.APP_PORT ?? "3000"` (unset
defaults to 3000), and throws
`` `APP_PORT must be a positive integer, got "${portRaw}"` `` if the result isn't a positive
integer.

`uploadMaxBytes` is `Number(env.UPLOAD_MAX_BYTES ?? "1073741824")` (1 GiB default), validated
the same way as `APP_PORT` — throws `` `UPLOAD_MAX_BYTES must be a positive integer, got
"${raw}"` `` for anything that isn't a positive integer. It ceilings a single upload's file
part in [[ingestion]]'s `/library/uploads` route.

`commit` is `env.GIT_COMMIT ?? "unknown"` — unvalidated. It is baked into the image at build time
(`GIT_COMMIT` build arg; see [[container-image]]), not read from `.env`.

`loadConfig` itself never reads `TEST_DATABASE_URL` — the running server always connects with
`DATABASE_URL`. `TEST_DATABASE_URL` only matters to code applying `migrate.ts`'s
`TEST_DATABASE_URL || DATABASE_URL` precedence: `apps/server/scripts/migrate.ts`,
`src/cli/create-operator.ts` (see [[operator-provisioning]]), and the environment-gated
integration test suites (see [[test-suite]]). On the **host**, `TEST_DATABASE_URL` names the
database from `localhost`, winning over `DATABASE_URL`'s container-only address (`@db:5432`).
Inside the **app container**, `docker-compose.yml` blanks `TEST_DATABASE_URL` to `""`, falling
through to `DATABASE_URL` — so `create-operator.ts` runs unmodified as `pnpm
auth:create-operator` on the host or `docker compose exec app node dist/cli/create-operator.js`
in the container (TASK-0036).

Since spec 020, `TEST_DATABASE_URL` names a **separate, throwaway database** — its own
per-worktree `docker-compose.test.yml` stack ([[runtime-stacks]]), not a host-reachable view
of the app's own `DATABASE_URL` database. Consequence: because `migrate.ts` prefers it, a bare
`pnpm db:migrate` run from the host migrates the **test** database, not "the app database" a
developer might expect from muscle memory. Migrating the app database from the host needs an
explicit override (`.env.example`, research R7):
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

## Where secrets and shared keys live (spec 022)

`.env.example` is a per-worktree template; secrets and config shared across
every worktree — API keys, `AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES` — belong in the **root
checkout's** `.env`, not in a worktree's. `pnpm env:up` (see [[runtime-stacks]]) copies every
key from the root `.env` into the worktree's own `.env`, except the five derived keys
(`APP_PORT`, `DB_PORT`, `STACKS_ENV`, `TEST_DB_PORT`, `TEST_DATABASE_URL`), which are always
per-worktree and never come from root. Root's value wins over whatever the worktree's `.env`
already had for that key, so editing the root file and re-running `env:up` is how a shared
key (a rotated `NINEROUTER_API_KEY`, a changed `AI_PURPOSES`) reaches every worktree — there
is no per-worktree override. `env:up` prints the inherited key names (never values); `.env`
itself, in any worktree, is still git-ignored and never committed.

## Connections

Read by [[server-entrypoint-and-app]] (`index.ts` calls `loadConfig()` once, unconditionally)
and by [[compose-stack]]'s env-var contract. `.env.example` is the template `docker-compose.yml`
and this file both assume, and now also documents the AI gateway's three env vars (see
[[ai-gateway]]), retrieval's three (see [[retrieval]]), and (TASK-0027) answering's one,
`ASK_MIN_SIMILARITY` (see [[rules-answerer]]), a commented seven-purpose `AI_PURPOSES` example for the DM runtime (TASK-0046, [[dm-runtime]]), and a commented `DM_FAKE_SCRIPT=greyhollow-live` (TASK-0158). See [[overview]]'s "environment contract"
callout for the same trap at a higher level.

## Operational notes

Required: `DATABASE_URL` (no default; `loadConfig` throws without it). Optional: `APP_PORT`
(default `3000`), `GIT_COMMIT` (default `"unknown"`, Dockerfile build arg, never `.env`),
`UPLOAD_MAX_BYTES` (default `1073741824`); both numbers must be positive integers. `AI_PROVIDERS`/`AI_PURPOSES`/`AI_PRICES` are read
by `index.ts` via `ai/config.ts`'s `loadAiConfig`, not by `loadConfig` itself (see
[[ai-gateway]]; unset means no model features, not an error). `RETRIEVAL_MODE`/`RETRIEVAL_K`/
`RETRIEVAL_EMBED_PURPOSE` are the same shape — optional, Zod-validated by `library/retrieve.ts`'s
`loadRetrievalConfig`, also called by `index.ts` rather than `loadConfig` (see [[retrieval]]).
`DM_FAKE_SCRIPT` (TASK-0158, specs/053) is optional: a name matching `^[a-z0-9][a-z0-9-]{0,63}$` for a file in `apps/server/dm-scripts/`. When set, `createAiRuntime` in `dm/script/env.ts` (called by `index.ts`, not `loadConfig`) replaces the whole AI config, so `AI_PROVIDERS`/`AI_PURPOSES`/`AI_PRICES` are not read, and boot throws unless `STACKS_ENV` is a worktree name (unset, empty, `default`, `main` and `dev` refuse). Set it in a worktree `.env`: root's value would win ([[runtime-stacks]], [[ai-gateway]]; walkthrough `specs/053-env-fake-dm-script/quickstart.md`).
The DM runtime otherwise adds no env var: it reads seven `dm.*` entries of `AI_PURPOSES` (all `op: "chat"`, with `maxTokens` per purpose; names in [[ai-gateway]]); `index.ts` warns by name at boot about any missing, and a missing one fails only the node that calls it (see [[ai-gateway]]). The playtest CLI ([[playtest-harness]]) adds `playtest.audit` and uses `AI_PRICES` to cap a provider run; optional `PLAYTEST_DATABASE_URL` (loopback only) overrides its database (default `TEST_DATABASE_URL || DATABASE_URL` + `_playtest`). `loadConfig` reads none of these. `ASK_MIN_SIMILARITY` (TASK-0027) is the same shape again — optional (default `0.3`),
Zod-validated by `library/answer.ts`'s `loadAnswerConfig`, also called by `index.ts` (see
[[rules-answerer]]). `TEST_DATABASE_URL` (and its port, `TEST_DB_PORT`, default `5433`) is consulted
only by host-run code (`migrate.ts`, integration tests), never by `loadConfig`/the running
server; leaving it unset makes the event-log integration tests skip rather than fail, a silent gap, not a passing suite.
`pnpm env:up` derives and writes both.
