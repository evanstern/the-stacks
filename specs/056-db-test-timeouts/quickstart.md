# Quickstart: measure and prove the DB test timeouts

The orchestrator runs every command here. Implementers do not: the auto-mode classifier denies
them the `TEST_DATABASE_URL` export.

## Prerequisites

1. In `.worktrees/task-0154`, run `pnpm install --frozen-lockfile` if `node_modules` is absent.
2. Run `pnpm env:up`.
3. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098). Restart the app.
4. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole `.env`.
5. Pick a scratch directory outside the repo for raw logs. Call it `$SCRATCH`.

## Filter used for every evidence file

```sh
grep '^@the-stacks/server:test:' "$SCRATCH/<raw>.log" \
  | grep -E '[0-9]+ ?ms|Test Files|Tests |timed out|FAIL|✓|×' \
  > specs/056-db-test-timeouts/evidence/<name>.txt
```

Read each evidence file before it is committed. It must hold no URL, key or password.

## Phase 1: measure (before the fix)

1. Alone:
   `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/scene.integration.test.ts test/playtest/harness.integration.test.ts test/playtest/provider.integration.test.ts 2>&1 | tee "$SCRATCH/alone.log"`.
   This output has no turbo prefix. Keep lines matching `[0-9]+ ?ms|Test Files|Tests ` into
   `evidence/alone.txt`.
2. Full: `REQUIRE_DATABASE=1 pnpm test 2>&1 | tee "$SCRATCH/baseline.log"`. Filter into
   `evidence/baseline.txt`. A failing baseline is expected and fine.
3. Check that `baseline.txt` shows per-test durations for the slow tests. If not, re-run with
   `REQUIRE_DATABASE=1 pnpm turbo run test --filter='!@the-stacks/shared' -- --reporter=verbose`.

## Phase 3: three consecutive full runs (after the fix)

1. Run `REQUIRE_DATABASE=1 pnpm test 2>&1 | tee "$SCRATCH/run-N.log"` for N = 1, 2, 3, one
   after another. Re-run nothing.
2. Filter each into `evidence/run-N.txt`.
3. Expect each run to exit 0 and every package's `Test Files` line to show no failure.
4. On any failure, rename its file to `evidence/run-failed-<k>.txt` and restart at N = 1
   (spec OQ-1 default (a)). Report a failure in a TASK-0154 test as a finding: its timeout is too small.
