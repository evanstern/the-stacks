# DB run: human-dm-scene.integration (T023)

Run by the orchestrator on 2026-10-28, on the `stacks-task-0159-test` database, at 8f6a283.
Only `TEST_DATABASE_URL` was exported from the worktree `.env`.

```
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/human-dm-scene.integration.test.ts
Tests  3 passed (3)
```

- (a) The human-DM scene-start turn leaves one pending `scene` proposal, policy `suggest`, with the seed's `sceneId`. `p.scene` is null.
- (b) Dismiss only: the `approval` turn ends `empty-beat` and `checkpoint.beat` is null (the no-scene path).
- (c) Carry out, then dismiss: the `approval` turn has no failure and `checkpoint.beat` is set, so the seed loaded and assemble ran. One `scene.changed` row.

The first run, at 79a2240, failed only on (c)'s row count (expected 2, got 1). One is correct: the human-DM scene-start writes no `scene.changed` row. Fixed in 8f6a283.
