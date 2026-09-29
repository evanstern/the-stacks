---
name: compose-stack
description: The two-service docker-compose topology (app, db), their health checks and start ordering, the deliberate 127.0.0.1 port binding on db, and why TEST_DATABASE_URL is blanked inside the app container. Load for deployment/env-var questions.
kind: component
sources:
  - docker-compose.yml
  - .env.example
  - healthcheck.js
verified_against: ba9fcbb4fa3bdc10f8e66f403cdee90a2093f752
---

# Compose stack

The whole deployment is two `docker-compose.yml` services — `app` (built from the repo's
`Dockerfile`) and `db` (`pgvector/pgvector:pg17`) — plus one named volume, `db-data`, for
Postgres's data directory. `app` publishes `${APP_PORT}:${APP_PORT}` on all interfaces; `db`
publishes only to loopback.

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

## Connections

[[container-image]] builds the image `app` runs. [[configuration]] is the env-var contract
this file's variables feed into. [[health-check]] is what `healthcheck.js` calls and what
`db`'s `pg_isready` stands in for. [[overview]] frames this as "two containers and a volume is
the whole deployment."

## Operational notes

Env vars in play: `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (db credentials, no
default password), `DATABASE_URL` (container-side connection string, host `db`), `DB_PORT`
(host-side Postgres port, default 5432), `APP_PORT` (both the app's listen port and its
published host port). A fresh clone with a filled-in `.env` must succeed with `docker compose
up` alone — see [[overview]]'s self-hostability note.
