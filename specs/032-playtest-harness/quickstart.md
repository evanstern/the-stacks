# Quickstart: validate the playtest harness and the auditor

Run from the task worktree. Contracts: [scenario](contracts/scenario.md),
[run directory](contracts/run-directory.md), [auditor](contracts/auditor.md),
[report schema](contracts/audit-report-schema.md), [cost guard](contracts/cost-guard.md),
[CLI](contracts/cli.md), [demo runbook](contracts/demo-runbook.md).

## 0. Stack

1. Run `pnpm env:up`.
2. Run `pnpm env:status` and export `DATABASE_URL` and `TEST_DATABASE_URL` from it.
3. If the databases are unmigrated (TASK-0098), run
   `pnpm --filter @the-stacks/server db:migrate` once per URL.

## 1. The CI case (AC #1, #2, #3)

1. Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/playtest`.
2. Expect every playtest test to pass and none to skip.
3. Run `REQUIRE_DATABASE=1 pnpm ci:check`. Expect exit 0. WebSocket gateway suites are
   known-flaky; re-run a failure there once before treating it as real.

## 2. The CLI in CI mode (AC #1, #2)

1. Run `pnpm playtest run`.
2. Expect stdout to name a run directory under `.playtests/`, outcome `ended`, verdict `pass`,
   spend `$0`.
3. Expect the run directory to hold `run.json`, `transcript.jsonl`, `transcript.md`,
   `ledger.json`, `jobs.json`, `usage.json`, `report.json`, `report.md`.
4. Expect `report.json` to show eight segments, zero `fail` findings, and `fight` not null.
5. Run `pnpm playtest audit --dir <that run directory> --auditor none`. Expect verdict `pass`
   and every segment `skipped`.

## 3. The auditor catches planted problems (AC #2)

1. Run `pnpm playtest audit --dir apps/server/test/playtest/fixtures/doctored --auditor none`.
2. Expect exit 1, verdict `fail`, and one `fail` finding per planted problem the fixture's
   `README` lists (at least `dice-lines`, `prose-digits`, `life-states`, `hidden-info`,
   `roll-reasons`, `dice-language`).

## 4. The cost guard (AC #3), no spend

1. Run `CI=1 pnpm playtest run --mode provider`. Expect exit 4 and no model call.
2. With no `AI_*` configuration, run `pnpm playtest run --mode provider`. Expect exit 4 naming
   every missing purpose.
3. With an operator configuration present, run `pnpm playtest estimate`. Expect the per-purpose
   table and exit 0.
4. Run `pnpm playtest run --mode provider` without a ceiling. Expect the estimate, exit 3, no
   model call, and no new run directory.

Steps 3 and 4 need the operator's configuration; the orchestrator runs them at the Phase 6
checkpoint, not an implementer.

## 5. The demo (AC #4, #5)

Follow `docs/design/m2-demo.md` (from [contracts/demo-runbook.md](contracts/demo-runbook.md)).
Only the orchestrator and the operator run it.

## 6. Clean up

1. Run `pnpm env:down` before removing the worktree.
2. Run `pnpm env:prune --check` and expect exit 0.
