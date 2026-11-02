# DB run (TASK-0175 Phase 3, T012)

`REQUIRE_DATABASE=1 pnpm ci:check` on stack `stacks-task-0175`, with only `TEST_DATABASE_URL` exported from the worktree `.env`: exit 0. No flaky test re-run was needed.
