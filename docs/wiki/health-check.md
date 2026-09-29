---
name: health-check
description: GET /health's always-200 HealthReport shape driven by an injected database probe, and why the Docker healthcheck (healthcheck.js) parses the JSON body's status field instead of trusting the HTTP status code. Load for health-endpoint or container-healthcheck questions.
kind: component
sources:
  - apps/server/src/routes/health.ts
  - healthcheck.js
  - docker-compose.yml
verified_against: 3a8cdcc4582c79a94fd18dcb5a03f09b6b3728c4
---

# Health check

`GET /health` always returns HTTP 200 by contract (per the route's comment, pointing at
`specs/002-compose-stack/contracts/healthcheck.md`); the actual health signal is in the
JSON body, not the status code. The Docker-level healthcheck that decides container health
is `healthcheck.js`, run as a separate process by `docker-compose.yml`.

## How it works

`createHealthRoute(databaseProbe: DatabaseProbe, commit: string)` registers `GET /` on its
own sub-router (mounted at `/health` in `app.ts`). The handler calls `await
databaseProbe.reachable()` and builds a `HealthReport`: `{ status: reachable ? "ok" :
"degraded", process: { uptimeSeconds: process.uptime() }, database: { reachable }, commit }`.
`status` is explicitly **derived**, never set independently — the code comment is emphatic
that it's `"ok"` only when every dependency fact below it is true, which at M0 means only the
one database check. `databaseProbe` is injected (constructed in `index.ts` from
`createDatabaseProbe(config.databaseUrl)`, see [[server-entrypoint-and-app]]), which is what
lets tests exercise both reachable and unreachable cases without a real Postgres connection.

`commit` is spec 010's addition (`specs/010-worktree-stacks/contracts/health.md`, amending the
fixed-seam `specs/003-hono-server/contracts/health.md` additively): [[configuration]]'s
`loadConfig` reads it from the baked-in `GIT_COMMIT` build arg (`"unknown"` if unset) and
`index.ts` passes it straight through to `createHealthRoute`. It never feeds `status` — an
`"unknown"` commit is not a degraded one — it just names which build is answering.

`healthcheck.js`, copied to `/app/healthcheck.js` by the Dockerfile (see
[[container-image]]) and invoked by `docker-compose.yml`'s `app.healthcheck.test: ["CMD",
"node", "/app/healthcheck.js"]`, is a small standalone script using only `node:http` (no
`curl`/`jq` on `node:22-alpine`, and Node is already present). It reads `APP_PORT` from the
environment (default `3000`), issues `GET http://127.0.0.1:{port}/health` with a 2000ms
timeout, accumulates the response body, and **parses it as JSON**: `process.exit(JSON.parse(body).status
=== "ok" ? 0 : 1)`. Any error (non-2xx handling is irrelevant here — it never even looks at
the status code), a JSON parse failure, a request error, or a timeout all `process.exit(1)`.

**Why parse the body instead of trusting the status code:** `/health` always returns 200
even when the database is unreachable (`status: "degraded"`), by contract. A healthcheck
that only checked "did I get a 2xx" would report the container healthy while its database
connection was down — exactly the failure mode the code comments in both `healthcheck.js`
and `docker-compose.yml` cite (referencing "research D1"). Parsing `status` from the body is
what lets Docker/Compose's `depends_on: condition: service_healthy` (used by nothing to gate
on `app`, since nothing depends on it, but used by `app` to gate on `db`'s own `pg_isready`
healthcheck) and orchestration tooling actually distinguish "listening" from "working."

## Connections

Wraps [[database-access]]'s `DatabaseProbe`/`createDatabaseProbe`. Registered first in
[[server-entrypoint-and-app]]'s route order. The container invocation is defined in
[[compose-stack]] and depends on the file layout from [[container-image]].

## Operational notes

`APP_PORT` must match between the running server and `healthcheck.js`'s read of
`process.env.APP_PORT` (both come from the same `env_file: .env`, so they agree in
practice). `healthcheck.js`'s default of `3000` if `APP_PORT` is unset matches `config.ts`'s
default. `interval: 5s, timeout: 3s, retries: 5` on `app`, with a 30s `start_period` grace
window before failures count.
