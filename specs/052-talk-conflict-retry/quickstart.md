# Quickstart: validate TASK-0157

Run every command from the worktree `.worktrees/task-0157`.

## Prerequisites

1. Run `pnpm install --frozen-lockfile` if `node_modules` is missing.
2. Run `pnpm env:up`. Migrate the test database by hand (fresh stacks come up unmigrated):
   `DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @the-stacks/server db:migrate`.
3. Export only `TEST_DATABASE_URL` from `.env`. Never `source` the whole file.
4. Build the workspace packages once: `pnpm turbo run build --filter=@the-stacks/server^...`.

## Scenarios

| # | Command (from `apps/server` unless noted) | Expected |
|---|---|---|
| 1 | `REQUIRE_DATABASE=1 npx vitest run test/gate.integration.test.ts -t "per-session ordering"` | Every test passes. Each burst lands every line once with 0 `CONFLICT`. |
| 2 | `REQUIRE_DATABASE=1 npx vitest run test/gate.integration.test.ts -t "sequence conflicts"` | Passes. `retryDelayMs` is called once per conflict before the last attempt. |
| 3 | `REQUIRE_DATABASE=1 npx vitest run test/ws.integration.test.ts` | 26/26 pass (25 existing plus the new burst test). No "CONFLICT refusal" warning is printed, because the resend helper is gone. |
| 4 | `pnpm bench:load run --tier commit --case concurrency-smoke --no-save` | `PASS concurrency-smoke`, 0 errors. |
| 5 | From `apps/web`: `npx vitest run test/play/reduce-frame.test.mjs` | Passes. A `CONFLICT` error frame yields the plain label plus `(CONFLICT)`. |
| 6 | From the worktree root: `pnpm ci:check` | Green. |

## Mutation check (proves scenario 1 tests the queue)

1. Bypass the queue in `apps/server/src/gate/gate.ts` so each write runs at once.
2. Run scenario 1. It must fail with at least one `CONFLICT`.
3. Restore the file. Run scenario 1 again; it must pass.
4. Run `git diff -- apps/server/src/gate/gate.ts` against the phase commit. It must be empty.
