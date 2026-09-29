---
name: test-suite
description: What the server's 11 test files / 73 tests cover, the environment-gated integration suites that loud-skip without a database (or throw under REQUIRE_DATABASE=1), and that apps/server/test/ is now its own typechecked project reference.
kind: concept
sources:
  - apps/server/test/auth.integration.test.ts
  - apps/server/test/auth.password.test.ts
  - apps/server/test/db.test.ts
  - apps/server/test/echo.test.ts
  - apps/server/test/events.integration.test.ts
  - apps/server/test/events.test.ts
  - apps/server/test/health.test.ts
  - apps/server/test/static.test.ts
  - apps/server/test/ws.integration.test.ts
  - apps/server/test/ws.protocol.test.ts
  - apps/server/test/ws.subscribe.test.ts
  - apps/server/package.json
  - apps/server/tsconfig.json
  - apps/server/test/tsconfig.json
  - tsconfig.json
verified_against: 77a25471a1b0235747925521d89eb1c1f4bb27e1
---

# Test suite

The server's tests run under Vitest (`pnpm --filter @the-stacks/server test`, i.e. `vitest
run`). There are 11 files. Three are integration suites that require a reachable Postgres —
`auth.integration.test.ts`, `events.integration.test.ts`, `ws.integration.test.ts` — covering
session auth (US1–US4), the event log's append/read/visibility, and the WebSocket gateway's
Phase 2–7 behavior (fan-out, server authority, the replay/live boundary, visibility filtering)
respectively. The rest are unit-level: password hashing, the DB reachability probe, the echo
route, plain event-log helpers, `/health`, static-serving/SPA-fallback ordering, and the
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
resolve): **8 test files pass, 3 skip** (the three integration files above), out of 11 — **31
tests pass, 42 skip**, out of 73 (spec 010 added one `health.test.ts` case for the `/health`
`commit` field — see [[health-check]] — to the unit-level 31). A green run in this state
proves the unit-level behavior only; every session-auth flow, every event-log write/read, and
the entire WebSocket gateway (including [[replay-live-boundary]] and [[subscriber-registry]])
goes unverified. Anyone reading only a pass/fail summary, not the warning text, would not
notice. With a reachable database and `REQUIRE_DATABASE=1` (as [[ci-pipeline]] runs it), all
**73 tests pass, 0 skip**.

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
[[ws-protocol]], [[session-auth]], and [[event-log]]. The manual, human-run counterpart that
exercises the same seams end to end through the real client is [[m0-demo]]. [[ci-pipeline]]
runs this suite on every PR and push with `REQUIRE_DATABASE=1`; the manual demo is still run
and pasted into each PR by hand.

## Operational notes

`packages/shared` must be built (`tsc -b`) before the server's tests can resolve
`@the-stacks/shared` — a fresh `pnpm install` alone is not sufficient; Turborepo's task graph
normally handles this ordering, but a bare `vitest run` in `apps/server` does not.
