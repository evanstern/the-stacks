# Quickstart: validate the output claim gate (spec 051)

## Prerequisites

1. Run `pnpm install --frozen-lockfile` in the worktree.
2. For the DB suites: run `pnpm env:up`, migrate both databases by hand, restart the app, and
   export only `TEST_DATABASE_URL` from the worktree `.env`.

## Pure checks (no database)

1. Run `pnpm --filter @the-stacks/server exec vitest run test/dm/claim-evidence.test.ts`.
   Expect these to pass:
   - M2 seq 225 refused on "Two down".
   - F52 refused against the recorded state and passed with `absent` rows.
   - The row 162 rebuild refused.
   - The run 192319Z seq 216 and M2 seq 220 controls passed.
2. Run `pnpm --filter @the-stacks/server exec vitest run test/dm/claims.test.ts test/dm/audit.test.ts test/dm/fallback.test.ts test/dm/narrate.test.ts`.
3. Run `pnpm check:boundaries`. Expect narrate's import closure to hold no engine value.

## Turn loop (database)

1. Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/audit.integration.test.ts`.
2. Expect the `audit-claim-fallback` case to show the following:
   - three blocking "Actor state:" attempts;
   - `dm.audit` skipped on each attempt;
   - a fallback with a journal flag.
3. Expect the withheld-`goalNote` case to show an empty "Private note:" in the prompt.

## Whole gate

1. Run `pnpm ci:check`.
2. Run `pnpm playtest run` in CI mode (fake gateway). Expect no rise in fallback turns against
   `origin/main`.
