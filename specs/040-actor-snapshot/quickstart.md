# Quickstart: verify the actor snapshot (TASK-0140)

Run every command from the worktree root `.worktrees/task-0140`.

## 1. Unit and prompt tests (no database)

```sh
pnpm --filter @the-stacks/server exec vitest run test/dm/snapshot.test.ts test/dm/snapshot-diff.test.ts test/dm/snapshot-render.test.ts
pnpm --filter @the-stacks/server exec vitest run test/dm/narrate.test.ts test/dm/audit.test.ts test/dm/interpret-prompt.test.ts test/dm/assemble.test.ts test/dm/runner.test.ts test/dm/player-facing-prompts.test.ts test/dm/boundary.test.ts
```

Expected: all pass. `snapshot-render.test.ts` shows the 50-actor render with every id once and
the overflow case throwing `SNAPSHOT_OVERFLOW`.

## 2. Retired names are gone

```sh
grep -rn "projectionEntries\|npcNames" apps/server/src apps/server/test
```

Expected: no output.

## 3. Database suites and the scripted CI playtest

1. Run `pnpm env:up`.
2. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
3. Restart the app.
4. Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test`.

Expected: green, including `test/dm/resolve.integration.test.ts` (S1 and the diff),
`test/dm/chronicle.integration.test.ts`, `test/dm/companion.integration.test.ts` and
`test/playtest/playtest.integration.test.ts`. Leave the stack up for the orchestrator.

## 4. Full gate

```sh
pnpm ci:check
node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki
node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .
```

Expected: green, `OK`, exit 0.
