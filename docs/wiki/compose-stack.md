---
name: compose-stack
description: The two-service docker-compose topology (app, db), their health checks and start ordering, the deliberate 127.0.0.1 port binding on db, and why TEST_DATABASE_URL is blanked inside the app container. Load for deployment/env-var questions.
kind: component
sources:
  - docker-compose.yml
  - docker-compose.test.yml
  - .env.example
  - healthcheck.js
verified_against: faf8c9afd700d1e13ef693f2fd70b39738160752
---

# Compose stack

The whole deployment is two `docker-compose.yml` services — `app` (built from the repo's
`Dockerfile`) and `db` (`pgvector/pgvector:pg17`) — plus one named volume, `db-data`, for
Postgres's data directory. `app` publishes `${APP_PORT:-3000}:${APP_PORT:-3000}` on all
interfaces; `db` publishes only to loopback. The `:-3000` default matters beyond
self-hoster convenience: `docker-compose.test.yml` (spec 020, see below) `extends` this
file, and CI runs that file with no `APP_PORT` set at all — an unset interpolation would
otherwise fail compose's config resolution.

Every container also carries three labels — `org.the-stacks.env`,
`org.the-stacks.worktree`, `org.the-stacks.commit` — read from `STACKS_ENV`/`STACKS_WORKTREE`/
`STACKS_COMMIT` (defaults `default`/empty/`unknown` for a plain `docker compose up`). `app`'s
`build:` is the long form, adding `args.GIT_COMMIT: ${STACKS_COMMIT:-unknown}` so the image
bakes in the commit it was built from (see [[container-image]]). Both are spec 010's
per-worktree stack machinery (`scripts/env.mjs`, not covered by this note); this file only
supplies the compose-level plumbing they read.

## How it works

`app.depends_on.db` uses `condition: service_healthy`, so the app container does not start
until `db`'s own healthcheck (`pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`, via
`CMD-SHELL`) passes. `db`'s healthcheck has a 10s `start_period`; `app`'s has 30s, giving a
database that is up but not yet accepting connections room to converge before the app is
judged unhealthy (this is a *grace period*, not a proof the app waits for it — compose
sequencing plus `depends_on: service_healthy` is what actually orders startup).

`app`'s healthcheck runs `node /app/healthcheck.js` inside the container (see
[[health-check]] for what that script does) rather than a shell one-liner, because
`node:22-alpine` has no `curl`/`jq` and Node is already present.

Both services load `env_file: .env` (git-ignored; `.env.example` is the template, with
`POSTGRES_PASSWORD` deliberately given no default so Postgres refuses to start unset). `db`'s
port mapping is `127.0.0.1:${DB_PORT:-5432}:5432` — bound to loopback **deliberately**, not
`0.0.0.0`. The reason, per the inline comment: the host needs to reach Postgres so
integration tests and migrations can run against a real database, but the LAN does not; an
unqualified `5432:5432` would publish a self-hoster's database to their whole network.
`DB_PORT` exists so a host that already has something on 5432 can override it.

`app`'s `environment:` block sets `TEST_DATABASE_URL: ""`, overriding whatever `env_file`
would otherwise inject. The reasoning, verbatim from the compose file's comment:
`TEST_DATABASE_URL` is a host-only variable pointing at the loopback-published port; inside
the container `localhost` means the container itself, where nothing is listening, so leaving
it set would make anything that prefers it break. Blanking it lets `DATABASE_URL` (`@db:5432`)
govern inside the container. This only works because the code that chooses between the two
uses `||`, not `??` — see [[configuration]].

**The test compose file (spec 020).** `docker-compose.test.yml` is a separate, DB-only
project (`stacks-<env>-test`) whose one service, `db`, `extends: { file: docker-compose.yml,
service: db }` rather than repeating the `pgvector/pgvector:pg17` pin — the image is named in
exactly one tracked place, this file, so a version bump there reaches the app stack, the test
stack, and CI alike (spec 020 FR-003). The test file overrides `env_file` (`!reset []`,
fixed throwaway credentials `stacks`/`stacks`/`stacks` instead of `.env`), `volumes` (`!reset
[]`, replaced by a `tmpfs` mount — no named volume, so the data is disposable and `down -v`
is trivially clean), and `ports` (`!override`, its own `TEST_DB_PORT` range rather than
`DB_PORT`'s). See [[runtime-stacks]] for how `env up`/`env down` drive this second project
alongside the app one, and [[test-suite]]/[[ci-pipeline]] for who connects to it.

## Connections

[[container-image]] builds the image `app` runs. [[configuration]] is the env-var contract
this file's variables feed into. [[health-check]] is what `healthcheck.js` calls and what
`db`'s `pg_isready` stands in for. [[overview]] frames this as "two containers and a volume is
the whole deployment." [[runtime-stacks]] is what sets the `org.the-stacks.*`/`STACKS_COMMIT`
values this file only consumes, and what brings `docker-compose.test.yml`'s project up/down
alongside this one. [[hosted-dev]]'s `deploy/dev/compose.dev.yml` (TASK-0021, spec 016)
layers on top of this file on vm-104: a fixed secrets path in place of `.env`, and `app`'s
port rebound to loopback-only, matching `db`'s existing bind.

## Operational notes

Env vars in play: `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (db credentials, no
default password), `DATABASE_URL` (container-side connection string, host `db`), `DB_PORT`
(host-side Postgres port, default 5432), `APP_PORT` (both the app's listen port and its
published host port, default 3000), `TEST_DB_PORT` (the test stack's host-side port, default
5433 — read only by `docker-compose.test.yml`, not this file). A fresh clone with a
filled-in `.env` must succeed with `docker compose up` alone — see [[overview]]'s
self-hostability note.
