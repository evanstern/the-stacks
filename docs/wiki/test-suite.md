---
name: test-suite
description: What this note's 12 core server test files / 90 tests cover, the environment-gated integration suites that loud-skip without a database (or throw under REQUIRE_DATABASE=1), and that apps/server/test/ is now its own typechecked project reference. The larger, separate ingestion-pipeline suite under test/library/ is [[ingestion]].
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
verified_against: 66f6c026d9aee137ccb9c236dd7874359c02d6ae
---

# Test suite

The server's tests run under Vitest (`pnpm --filter @the-stacks/server test`, i.e. `vitest
run`). This note's scope is the 12 files below, at the top of `apps/server/test/`; TASK-0024
added a much larger suite alongside them under `apps/server/test/library/` — see [[ingestion]]
for that one, and its `ai.*.test.ts` siblings predate this note and aren't covered here either.
TASK-0030 added a third such subdirectory, `apps/server/test/bench/` (one unit file, two
environment-gated integration files, the same loud-skip pattern as this note's three) — see
[[benchmarks]] for what it covers and why 5 of its tests are *always* skipped, by name, even
with a reachable database.
Of these 12, three are integration suites that require a reachable Postgres —
`auth.integration.test.ts`, `events.integration.test.ts`, `ws.integration.test.ts` — covering
session auth (US1–US4), the event log's append/read/visibility, and the WebSocket gateway's
Phase 2–7 behavior (fan-out, server authority, the replay/live boundary, visibility filtering)
respectively. The rest are unit-level: password hashing, `loadConfig`'s `uploadMaxBytes`
validation (`config.test.ts`, TASK-0024), the DB reachability probe, the echo route (including
a generic `PayloadTooLargeError` → 413 case added for TASK-0024, see [[error-contract]]),
plain event-log helpers, `/health`, static-serving/SPA-fallback ordering, and the
protocol/subscribe modules in isolation.

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
tests pass, 43 skip**, out of 90 (TASK-0024 added `config.test.ts`'s 5 always-run cases and one
case to `echo.test.ts`'s gated-free `describe`, on top of TASK-0032's `isUniqueViolation`
cases). A green run in this state proves the unit-level behavior only; every session-auth flow,
every event-log write/read, and the entire WebSocket gateway (including
[[replay-live-boundary]] and [[subscriber-registry]]) goes unverified. Anyone reading only a
pass/fail summary, not the warning text, would not notice. With a reachable database and
`REQUIRE_DATABASE=1` (as [[ci-pipeline]] runs it), all **90 tests pass, 0 skip**.

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
