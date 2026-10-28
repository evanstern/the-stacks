# Mutation check: STACKS_ENV guard (T006)

Commit under test: 7144696.

1. Replaced the `STACKS_ENV` deny condition in `apps/server/src/dm/script/env.ts` with `if (false)`.
2. Ran `test/dm/script-env.test.ts`: 5 failed, 12 passed. Failing cases:
   - refuses script mode when STACKS_ENV is undefined
   - refuses script mode when STACKS_ENV is ""
   - refuses script mode when STACKS_ENV is "default"
   - refuses script mode when STACKS_ENV is "main"
   - refuses script mode when STACKS_ENV is "dev"
3. Restored the file with `git checkout -- apps/server/src/dm/script/env.ts`.
4. `git diff -- apps/server/src/dm/script/env.ts` is empty. The file reran green: 17 passed.
