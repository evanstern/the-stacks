# Mutation guard (spec 065, T031, plan D7)

Run: `REQUIRE_DATABASE=1 vitest run test/dm` (65 files, 799 tests) on stack `stacks-task-0180`.
Each stub is inserted as the first statement of the function, run, then restored with `git checkout`. `git diff` was empty after each restore.

| Stub | Failing tests | Failing files |
|---|---|---|
| `codeTriggers` returns `[]` | 9 | 3 |
| `capReached` returns `false` | 3 | 3 |
| `legalEscalation` returns `true` | 2 | 1 |

Each stub fails at least one test.
