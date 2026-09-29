# Quickstart: prove the redeem conflict fix

Run every command from the worktree root `.worktrees/task-0032`.

1. Start this worktree's stack: `pnpm env:up`.
2. Read `TEST_DATABASE_URL` from the generated `.env` (see `docs/wiki/runtime-stacks.md`).
3. Run the auth suite with the database required:
   `REQUIRE_DATABASE=1 TEST_DATABASE_URL=<url> pnpm --filter @the-stacks/server exec vitest run test/auth.integration.test.ts test/db.test.ts`
   Expect: 0 skipped; the taken-username case passes.
4. Run the library suite the same way (`test/library/store.integration.test.ts`).
   Expect: 0 skipped; existing conflict cases still pass.
5. Run the whole gate: `REQUIRE_DATABASE=1 TEST_DATABASE_URL=<url> pnpm ci:check`.
6. Check the single-copy rule: `grep -rn "23505" apps/server/src` prints one line, in `db.ts`.
7. Stop the stack: `pnpm env:down`.

Before the fix, step 3's new case fails: `redeemInvitation` throws a `DrizzleQueryError`
instead of returning `conflict`.
