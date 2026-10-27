# Quickstart: validate group sign-off

Prerequisites: the worktree has `node_modules` (`pnpm install --frozen-lockfile`), and its
own stack is up and migrated (`pnpm env:up`, then migrate both databases by hand).

1. Pure rule and planner: `pnpm --filter @the-stacks/session-model test`. Expect the
   `gate-signoff`, `gate-authority` (SC-006 over every fixture, `group-signoff` included),
   `gate-plan` and `fixtures` suites green.
2. Merge condition, two human seats on the real log: export only `TEST_DATABASE_URL` from
   the worktree `.env`, then
   `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/gate.signoff.integration.test.ts`.
   Expect: approval auto-commits with a `signoff` marker naming both seats; an objection
   refuses `GROUP_SIGNOFF_REQUIRED` with `details.objecting`; the DM commits over it.
3. Enqueuer: `REQUIRE_DATABASE=1 … vitest run test/dm/companion-react.integration.test.ts`.
4. Web: `pnpm --filter @the-stacks/web test`. Open `play/fixtures` (operator) on the
   `group-signoff` fixture in Brave: one row approved, one waiting, Approve/Object on the
   viewer's own row, no dialog.
5. `pnpm ci:check` green.
