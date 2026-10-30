# Mutation guard and DB run (T027, T028)

Run by the orchestrator on 2026-10-30 against 7cfb4815, on the worktree stack `stacks-task-0182`, with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported.

## T027: DB suites

`REQUIRE_DATABASE=1 pnpm ci:check` exited 0. Server: 122 files passed, 1 skipped; 1379 tests passed, 5 skipped. Web: 139 passed. No timeout re-run was needed.

## T028: mutation guard

Tests: `test/dm/first-stage.test.ts`, `test/dm/runner.test.ts` and `test/dm/plan-first-step.integration.test.ts` (34 tests).

- M1 makes `firstStage` keep every step.
- M2 makes `holdDirector` return its input.

```
M1 firstStage keeps every step:
     × resolves two stealth checks and holds the rest of the plan 715ms
     × cuts once before resolve and stores cut: true in one save 5ms
     × keeps a same-skill check run whole and cuts the rest 6ms
     × cuts a different-skill second check 1ms
     × cuts in free mode and writes reasons as follow-ups 1ms
     × keeps model follow-ups, merges, dedupes and caps at six 1ms
      Tests  6 failed | 28 passed (34)
M2 holdDirector holds nothing:
     × resolves two stealth checks and holds the rest of the plan 712ms
     × cuts once before resolve and stores cut: true in one save 5ms
     × holds turn, trackers and scene end with three overrides 5ms
     × adds no override when holding an already-held output 1ms
      Tests  4 failed | 30 passed (34)
restored:
      Tests  34 passed (34)
status: []
```

Each mutation was restored with `git checkout`. `git status --short` was empty afterwards.

## Fixes found on the stack before this run

- The Director reply in the fixture was missing `tableMode.reason` (fixed in 7b9b7583). `dm-scripts.test.ts` now schema-checks the replies offline.
- The test filtered on event types that do not exist, such as `check.roll`. It now uses catalog names (a7d49c0f).
- The orchestrator scoped the negative assertions to rows after `action.committed`, because the scene start writes `combatant.added` and `tracker.changed`. It also unwrapped the engine event from `payload.event`.
