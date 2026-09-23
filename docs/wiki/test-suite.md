---
name: test-suite
description: What the server's 11 test files / 72 tests cover, the environment-gated integration suites that loud-skip to 30 passed / 42 skipped without a database, and that apps/server/tsconfig.json excludes test/ from typechecking (TASK-0017).
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
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
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

**The environment-gated pattern (loud-skip).** Each integration file resolves
`TEST_DATABASE_URL || DATABASE_URL` at module load, builds a client and probes it with
`probeReachable`, and wraps its whole `describe` block in `describe.skipIf(!reachable)`. When
unreachable, it does not fail — it `console.warn`s a multi-line notice naming the file, which
spec/user-story it would have exercised, and the exact `docker compose up -d db` +
`TEST_DATABASE_URL=...` incantation to fix it, then Vitest reports the suite `skipped`, not
`failed`. This is deliberate: **a silent skip and a fake pass would both be green**, and the
whole point of the notice is to make "proved nothing" visibly different from "proved
something" in the run's output.

**Verified counts, run without a database configured** (`unset TEST_DATABASE_URL
DATABASE_URL`, `pnpm install` + building `packages/shared` first so imports resolve): **8
test files pass, 3 skip** (the three integration files above), out of 11 — **30 tests pass,
42 skip**, out of 72. A green run in this state proves the unit-level behavior only; every
session-auth flow, every event-log write/read, and the entire WebSocket gateway (including
[[replay-live-boundary]] and [[subscriber-registry]]) goes unverified. Anyone reading only a
pass/fail summary, not the warning text, would not notice.

**`test/` is not typechecked.** `apps/server/tsconfig.json` scopes `"include": ["src"]` —
`test/` is outside it. `pnpm typecheck` (which runs `tsc -b`) never sees the test files at all;
a type error introduced only in a test is invisible until Vitest actually transpiles and runs
that file. This is a known, tracked gap (TASK-0017), not an oversight this note is the first
to notice.

## Connections

Exercises [[websocket-gateway]], [[replay-live-boundary]], [[subscriber-registry]],
[[ws-protocol]], [[session-auth]], and [[event-log]]. The manual, human-run counterpart that
exercises the same seams end to end through the real client is [[m0-demo]] — there is **no
CI** at this commit (see [[overview]]), so both this suite and the manual demo are run and
their output pasted into each PR by hand.

## Operational notes

`packages/shared` must be built (`tsc -b`) before the server's tests can resolve
`@the-stacks/shared` — a fresh `pnpm install` alone is not sufficient; Turborepo's task graph
normally handles this ordering, but a bare `vitest run` in `apps/server` does not.
