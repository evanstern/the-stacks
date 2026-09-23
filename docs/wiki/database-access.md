---
name: database-access
description: The one pool-building helper (createPool) shared by the Drizzle client (createDb) and the health probe (createDatabaseProbe), the pool's mandatory error handler, and what "reachable" actually tests (a bounded SELECT 1 race, not a real query).
kind: component
sources:
  - apps/server/src/db.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Database Access

`apps/server/src/db.ts` is the only place a `pg.Pool` is constructed in this codebase. Both
the Drizzle client used for real queries and the liveness probe used by `/health` are built
on top of the same `createPool` helper, so there is exactly one connection path to protect
rather than two independently-wired ones.

## How it works

`createPool(databaseUrl, timeoutMs)` builds a `pg.Pool` with `connectionTimeoutMillis` set to
`timeoutMs`, and — the part that matters — attaches an `error` listener. `pg.Pool` is an
`EventEmitter`; when Postgres drops an idle pooled connection (for example `57P01`,
"terminating connection due to administrator command", which fires when the `db` container
stops), the pool emits `'error'` on itself. Node's default behavior for an unhandled
EventEmitter `'error'` is to throw, which would crash the whole process before `/health` ever
gets a chance to report degraded (see [[health-check]]). The listener only logs
`err.message`, deliberately not the whole error object, since `pg-pool` attaches the dead
client (sockets, buffers) to `err.client`.

`createDb(databaseUrl)` wraps `drizzle(createPool(databaseUrl, DEFAULT_PROBE_TIMEOUT_MS))`
(`DEFAULT_PROBE_TIMEOUT_MS` = 3000ms). The returned client exposes `$client` — the underlying
pool — so callers that need to shut down cleanly (`scripts/migrate.ts`,
`scripts/create-operator.ts`) can call `db.$client.end()`.

`createDatabaseProbe(databaseUrl, timeoutMs)` builds its own pool the same way and returns a
`DatabaseProbe` with `reachable()` and an optional `close()` (`pool.end()` — tests use it, the
running process doesn't). `reachable()` delegates to `probeReachable`, which races
`db.query("SELECT 1")` against a `setTimeout` that resolves `false` after `timeoutMs`, and
catches any rejection (refused connection, query error) into `false` as well — the probe never
throws, it only ever resolves `true` or `false`. `probeReachable` takes a minimal `Queryable`
interface (just `query(sql): Promise<unknown>`) rather than a real `pg.Pool`, specifically so
the timeout-racing logic is testable without a live Postgres connection.

`DEFAULT_PROBE_TIMEOUT_MS` (3000ms) is chosen to leave headroom under the 5-second overall
bound `/health` guarantees.

## Connections

Feeds [[health-check]] (via `createDatabaseProbe`) and [[event-log]] / [[database-schema]]
(via `createDb`, the Drizzle client every query in this codebase goes through). Its
`DATABASE_URL` input is documented in [[configuration]].

## Operational notes

`createDb` and `createDatabaseProbe` both require a full Postgres connection string; neither
reads the environment itself — callers (`apps/server/src/index.ts`, the scripts under
`apps/server/scripts/`) resolve `DATABASE_URL`/`TEST_DATABASE_URL` first and pass the string
in. A dropped idle connection degrades the pool but never crashes the process, by design of
the `error` handler above.
