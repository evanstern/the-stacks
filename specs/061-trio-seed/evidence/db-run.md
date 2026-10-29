# DB run (T013)

**Date**: 2026-10-28, at a3df1f21, on the `stacks-task-0176` test DB (:25176), migrated.
Only `TEST_DATABASE_URL` was exported from the worktree `.env`, with `REQUIRE_DATABASE=1`.

- `trio.integration`, `duo.integration`, `routes.integration` and `scene.integration`: 4 files,
  28 passed. No timeout; no re-run.
- `REQUIRE_DATABASE=1 pnpm ci:check`: exit 0. Server: 120 files passed, 1 skipped; 1350 tests
  passed, 5 skipped.
