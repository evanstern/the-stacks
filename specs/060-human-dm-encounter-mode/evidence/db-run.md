# DB run (T025)

**Date**: 2026-10-28, at 93955186, on the `stacks-task-0165` test DB (:25165), migrated.
Only `TEST_DATABASE_URL` was exported from the worktree `.env`, with `REQUIRE_DATABASE=1`.

Suites: `human-dm-encounter.integration`, `human-dm-scene.integration`, `human-dm-roll-resume`,
`floor-jobs`, `enqueue-floor` and `scene.integration`. Result: 6 files, 34 passed.

The full `REQUIRE_DATABASE=1 pnpm ci:check` runs on the final tree before the PR; its result is in
the PR body.
