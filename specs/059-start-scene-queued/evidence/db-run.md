# DB run (T023)

**Date**: 2026-10-28. **Database**: the `stacks-task-0167` test DB (:25167), migrated.
Only `TEST_DATABASE_URL` was exported from the worktree `.env`, with `REQUIRE_DATABASE=1`.

## Red run (T003)

With `apps/server/src/routes/dm.ts` at 21be5ba9 (before Phase 1's T006), case (e) in
`human-dm-scene.integration.test.ts` failed: `expected 202 to be 409`. Before this change a second
human-DM start was accepted. The route was restored; `git diff` was empty.

## Green run

At aad6f308: `routes.integration`, `human-dm-scene.integration`, `human-dm-roll-resume`, `duo`,
`scene.integration`, `worker` and `scene-start.test`. Result: 8 files, 66 passed.

Earlier, at a09be525 (Phase 1): `human-dm-scene.integration`, `routes.integration` and
`scene-start.test`: 3 files, 36 passed.
