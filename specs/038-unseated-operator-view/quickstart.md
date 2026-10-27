# Quickstart: validate TASK-0118

## Automated

1. Run `pnpm --filter @the-stacks/web test` in the worktree.
2. Confirm `viewer.test.mjs` passes, including the unseated-operator rows (AI seat; another
   user's human seat).
3. Confirm `table-view.test.tsx` passes the unseated-operator render test (no "Pending
   proposals").
4. Run `pnpm ci:check`. Expect green.

## Manual (optional, Brave)

1. Run `pnpm env:up`, migrate both databases, and start the app.
2. Sign in as the operator. Open `/play/<sessionId>` for a session with an AI DM seat where
   the operator controls no character.
3. Expect: no "Pending proposals" trigger; "Action" unavailable with the hint "You control no
   party character, so you cannot declare an action."
