# Mutation guard (spec 054, T013)

## (a) Human-count rule, run by the implementer (no database)

- File: `apps/server/src/dm/seed/load.ts`, `crossCheckSeed`.
- Edit: `if (humans < 1) {` became `if (false) {`.
- Command: `cd apps/server && npx vitest run test/dm/seed.test.ts`
- Result: 1 failed, 34 passed. Failing case:
  `scene seed (AC #13) > requires at least one human seat`.
- Restore: `git checkout -- apps/server/src/dm/seed/load.ts`; `git diff -- <file>` printed 0 lines.

## (b) One-user-two-seats refusal: Orchestrator-run steps (database)

The implementer cannot export `TEST_DATABASE_URL`, so the orchestrator runs this one.

1. File: `apps/server/src/routes/dm.ts`, the start route (about line 240). Disable the third
   issue source: delete the `...seatOrder.filter(...).map(... "A user can hold only one seat." ...)`
   spread block, or replace its `.filter(...)` with `.filter(() => false)`.
2. Run, with `TEST_DATABASE_URL` exported from the worktree `.env` only:
   `cd apps/server && REQUIRE_DATABASE=1 npx vitest run test/dm/routes.integration.test.ts`
3. Expected failing case:
   `DM routes (database) > refuses one user in two seats and accepts two users`.
4. Restore: `git checkout -- apps/server/src/routes/dm.ts`; confirm
   `git diff -- apps/server/src/routes/dm.ts` is empty.
5. Record the failing case name below, then tick T013.

Result of (b): not yet run.

## Orchestrator-run steps: duo integration file (T012, T014)

1. `cd apps/server && REQUIRE_DATABASE=1 npx vitest run test/dm/duo.integration.test.ts`
   Expect 4 passed. A failure is a test assumption to correct, or a defect for
   `evidence/two-human-check.md`. Assumptions most likely to need a fix: case 3 (explicit commit
   by A with B absent) and case 4 (initiative order tamsin, kestrel, odo from `turn-floor-round.json` dice).
2. `REQUIRE_DATABASE=1 pnpm ci:check`, then tick T012 and T014.
