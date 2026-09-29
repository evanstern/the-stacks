# Quickstart: load bench validation

Run from the worktree `.worktrees/task-0030`. Commands and output formats are in
[contracts/bench-cli.md](contracts/bench-cli.md); results in
[contracts/results-format.md](contracts/results-format.md).

## Prerequisites

1. Run `pnpm env:up`. It starts the worktree's app stack and its DB-only test stack.
2. Run `export TEST_DATABASE_URL=$(grep ^TEST_DATABASE_URL= .env | cut -d= -f2-)`.
3. Run `pnpm install` and `pnpm build`.

## 1. List cases and tiers

Run `pnpm bench:load list`. Expect 7 cases: 2 `commit`, 4 `demand`, 1 `dev`.

## 2. Every-commit tier inside the test suite

Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- test/bench`.
Expect `ingest-smoke` and `concurrency-smoke` to pass. Expect 5 skipped entries, each named
`<id> [tier <tier>] — tier <tier> not selected`.

## 3. Every-commit tier from the CLI

Run `pnpm bench:load run --tier commit --no-save`.
Expect 2 case tables and 5 `SKIP` lines. Exit 0.

## 4. On-demand tier (the decision-0005 measurement)

Run `pnpm bench:load run --tier demand`.
Expect a table per worker count for `ingest-scaling` and a `VERDICT` line each, a
`concurrency-local` table and verdict, and pass/fail expectation lists for `db-exhaustion` and
`restart-mid-ingest`. Expect one new file under `apps/server/bench/load/results/`. It takes
about 10–15 minutes.

## 5. Dev tier guards (no network)

1. Run `LOAD_DEV_URL= pnpm bench:load run --tier dev --no-save`. Expect
   `SKIP concurrency-dev [tier dev]: dev target not configured (LOAD_DEV_URL unset)`, exit 0.
2. Run `LOAD_DEV_URL=https://example.invalid pnpm bench:load run --tier dev --no-save`. Expect
   `dev run refused; re-run with --allow-dev after operator sign-off`, exit 2.

## 6. Dev tier run (OPERATOR CHECKPOINT; orchestrator runs it)

Only after the operator's explicit go on the exact command:

```
LOAD_DEV_URL=https://vm-104.tailb3c1b6.ts.net:8443 \
LOAD_DEV_USERNAME=<operator-named> LOAD_DEV_PASSWORD=<operator-supplied> \
pnpm bench:load run --tier dev --allow-dev
```

Expect a `concurrency-dev` table, a verdict, `session ended: yes`, and one results file with
`target.kind: "dev"`. Commit the file.

## 7. Compare runs

Run `pnpm bench:load report`. Expect one group per (case, target), with local and dev rows
apart.

## Cleanup

Run `pnpm env:down`, then `pnpm env:prune --check`. The prune check must exit 0.
