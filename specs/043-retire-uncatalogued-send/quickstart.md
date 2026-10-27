# Quickstart: verify the retired send path

Run every command from the task worktree.

## Prerequisites

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm env:up`.
3. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
4. Restart the app.
5. Export only `TEST_DATABASE_URL` from the worktree `.env`. Do not source the whole file.

## Checks

| # | Command | Expected |
|---|---|---|
| 1 | `git grep -n appendUncataloguedEvent -- apps packages` | no output (SC-002) |
| 2 | `pnpm --filter @the-stacks/server exec vitest run test/write-boundary.test.ts` | pass: zero violations on `src/`, three on the fixture tree |
| 3 | `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/ws.integration.test.ts` | pass, including the `UNKNOWN_EVENT_TYPE` refusal test (SC-001, SC-004) |
| 4 | `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/bench` | pass |
| 5 | `pnpm bench:load` with the `concurrency-smoke` case (see `specs/021-load-bench/contracts/bench-cli.md`) | `pass`, zero errors, a non-null WebSocket round-trip p95 (SC-003) |
| 6 | `pnpm ci:check` | green (SC-005) |
| 7 | `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` | prints `OK` (after the wiki phase) |
| 8 | `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` | exits 0 |

A WebSocket gateway test that fails once and was not changed by this task gets one re-run.
Record the re-run in the commit message.

## Manual probe (optional)

Open a socket with a signed-in cookie, subscribe, then send
`{"type":"send","sessionId":"<id>","eventType":"chat","payload":{},"payloadVersion":1}`.
The reply is `{"type":"error","kind":"validation","code":"UNKNOWN_EVENT_TYPE",...}`, and the
connection stays open.
