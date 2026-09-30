---
name: test-suite
description: What this note's 12 core server test files / 91 tests cover, the environment-gated integration suites that loud-skip without a database (or throw under REQUIRE_DATABASE=1), and that apps/server/test/ is its own typechecked project reference. static.test.ts now tests createWebMiddleware's handler seam, including the load context's jobs() (TASK-0028). The larger ingestion suite is [[ingestion]]; the bench suite is [[benchmarks]]; the web app's own SSR suite is [[react-router-app]].
kind: concept
sources:
  - apps/server/test/auth.integration.test.ts
  - apps/server/test/auth.password.test.ts
  - apps/server/test/config.test.ts
  - apps/server/test/db.test.ts
  - apps/server/test/echo.test.ts
  - apps/server/test/events.integration.test.ts
  - apps/server/test/events.test.ts
  - apps/server/test/health.test.ts
  - apps/server/test/static.test.ts
  - apps/server/test/ws.integration.test.ts
  - apps/server/test/ws.protocol.test.ts
  - apps/server/test/ws.subscribe.test.ts
  - apps/server/test/bench/load.test.ts
  - apps/server/test/bench/load.integration.test.ts
  - apps/server/test/bench/load-db.integration.test.ts
  - apps/server/package.json
  - apps/server/tsconfig.json
  - apps/server/test/tsconfig.json
  - apps/server/vitest.config.ts
  - tsconfig.json
verified_against: a82067ceb8794332fc5106885fadc185f1c34c7b
---

# Test suite

The server's tests run under Vitest (`pnpm --filter @the-stacks/server test`, i.e. `vitest
run`). This note's scope is the 12 files below, at the top of `apps/server/test/`; TASK-0024
added a much larger suite alongside them under `apps/server/test/library/` — see [[ingestion]]
for that one, and its `ai.*.test.ts` siblings predate this note and aren't covered here either.
TASK-0029 and TASK-0030 share a third such subdirectory, `apps/server/test/bench/`: TASK-0029's
`bow`-embedding determinism unit test plus its per-commit recall regression gate, and
TASK-0030's unit file plus two environment-gated integration files, all run the same
loud-skip-or-throw pattern as this note's three below — see [[benchmarks]], including why 5 of
the load bench's tests are *always* skipped, by name, even with a reachable database.
Of these 12, three are integration suites that require a reachable Postgres —
`auth.integration.test.ts`, `events.integration.test.ts`, `ws.integration.test.ts` — covering
session auth (US1–US4, plus one case added for TASK-0040: the shared `identityLookup`
resolves the user for a live token and `null` after sign-out), the event log's
append/read/visibility, and the WebSocket gateway's Phase 2–7 behavior (fan-out, server
authority, the replay/live boundary, visibility filtering) respectively. The rest are
unit-level: password hashing, `loadConfig`'s `uploadMaxBytes` validation (`config.test.ts`,
TASK-0024), the DB reachability probe, the echo route (including a generic
`PayloadTooLargeError` → 413 case added for TASK-0024, see [[error-contract]]), plain
event-log helpers, `/health`, the web middleware's reserved-path/asset/handler-seam behavior
(`static.test.ts`, rewritten for TASK-0040 — see [[static-serving]]; TASK-0028 added one case
asserting the load context's `jobs()` resolves `null` with no cookie and never calls the
injected `listJobs`), and the protocol/subscribe modules in isolation.

## How it works

**The environment-gated pattern (loud-skip, or throw under `REQUIRE_DATABASE`).** Each
integration file resolves `TEST_DATABASE_URL || DATABASE_URL` at module load, builds a client
and probes it with `probeReachable`, and wraps its whole `describe` block in
`describe.skipIf(!reachable)`. When unreachable, it builds a multi-line notice naming the
file, which spec/user-story it would have exercised, and the exact `docker compose up -d db`
+ `TEST_DATABASE_URL=...` incantation to fix it. By default it only `console.warn`s that
notice and Vitest reports the suite `skipped`, not `failed` — deliberate, since **a silent
skip and a fake pass would both be green**, and the notice's job is to make "proved nothing"
visibly different from "proved something" in the run's output. When `REQUIRE_DATABASE=1` is
set, the same notice is `throw`n instead of warned, turning an unreachable database into a
hard failure — this is what [[ci-pipeline]] sets so CI cannot silently skip the suites it
exists to run.

**Verified counts, run without a database configured** (`unset TEST_DATABASE_URL
DATABASE_URL REQUIRE_DATABASE`, `pnpm install` + building `packages/shared` first so imports
resolve): **9 test files pass, 3 skip** (the three integration files above), out of 12 — **47
tests pass, 44 skip**, out of 91 (TASK-0024 added `config.test.ts`'s 5 always-run cases and one
case to `echo.test.ts`'s gated-free `describe`, on top of TASK-0032's `isUniqueViolation`
cases; TASK-0040 added one gated case to `auth.integration.test.ts` and rewrote
`static.test.ts` onto the new web-middleware seam, netting no change to the file's own test
count at the time; TASK-0028 added one always-run case to `static.test.ts` for the load
context's `jobs()`). A green run in this state proves the unit-level behavior only; every
session-auth flow, every event-log write/read, and the entire WebSocket gateway (including
[[replay-live-boundary]] and [[subscriber-registry]]) goes unverified. Anyone reading only a
pass/fail summary, not the warning text, would not notice. With a reachable database and
`REQUIRE_DATABASE=1` (as [[ci-pipeline]] runs it), all **91 tests pass, 0 skip**.

**`apps/server/vitest.config.ts`** (TASK-0024) sets `fileParallelism: false` for the whole
package — every suite in this note's scope included — because [[ingestion]]'s integration
suites share one real Postgres `jobs` queue across files; see that note for the full race it
closes. This only serializes file execution order, changing nothing about any individual
suite's pass/fail outcome.

**`test/` is now its own typechecked project reference.** `apps/server/test/tsconfig.json`
(`extends` the shared base, `noEmit: true`, `include: ["."]`, `references` both `apps/server`
and `packages/shared`) is a fourth entry in root `tsconfig.json`'s `references` array,
alongside `packages/shared`, `apps/server`, `apps/web`. `pnpm typecheck` (`tsc -b` at the
root) now builds this reference too, so a type error introduced only in a test fails
`typecheck` — it is no longer invisible until Vitest transpiles and runs the file. This
closes the gap TASK-0017 tracked; `apps/server/tsconfig.json` itself is unchanged (still
scopes `"include": ["src"]`, so `test/` stays out of the `src` build's own output).

## Connections

Exercises [[websocket-gateway]], [[replay-live-boundary]], [[subscriber-registry]],
[[ws-protocol]], [[session-auth]], [[event-log]], and, for `config.test.ts`, [[configuration]].
The manual, human-run counterpart that exercises the same seams end to end through the real
client is [[m0-demo]]. [[ci-pipeline]] runs this suite (and [[ingestion]]'s and
[[benchmarks]]' every-commit-tier suite) on every PR and push with `REQUIRE_DATABASE=1`; the
manual demo is still run and pasted into each PR by hand.

## Operational notes

`packages/shared` must be built (`tsc -b`) before the server's tests can resolve
`@the-stacks/shared` — a fresh `pnpm install` alone is not sufficient; Turborepo's task graph
normally handles this ordering, but a bare `vitest run` in `apps/server` does not.
