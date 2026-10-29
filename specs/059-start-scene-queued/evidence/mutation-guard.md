# Mutation guard (T024)

**Date**: 2026-10-28, at aad6f308, on the `stacks-task-0167` test DB.

Mutation: `sceneStartState` returns `none` for rule 3 (`apps/server/src/dm/scene-start.ts:39`,
`if (pending) return "pending";`).

Run: `scene-start.test` and `human-dm-scene.integration` with `REQUIRE_DATABASE=1`.

Result: 3 tests fail, the pure `pending` case, case (e) (the second start is 409) and case (f)
(`GET` returns `pending`). The guard holds.

The mutation was restored; `git diff` was empty.
