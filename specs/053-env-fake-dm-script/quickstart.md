# Quickstart: a narrated turn on a worktree stack, no key

Card AC #2. This runs the scripted fake DM on a worktree stack. No provider key is used, and no
call leaves the app process. Phase 4 of `tasks.md` runs it for real and records the run in
`evidence/live-run.md`.

## Prerequisites

- A worktree at `.worktrees/task-<n>`, with `pnpm install --frozen-lockfile` and `pnpm build` done.
- The root checkout's `.env` does NOT hold `DM_FAKE_SCRIPT`. A root key wins over a worktree key.
- Brave, for screenshots. The UI has no modals; panels are slide-out sheets.

## Steps

1. Run `pnpm env:up` in the worktree. Wait for both stacks to report healthy.
2. Migrate the app database by hand (fresh stacks come up unmigrated, TASK-0098):
   `TEST_DATABASE_URL=postgres://<user>:<password>@localhost:$DB_PORT/<db> pnpm --filter @the-stacks/server db:migrate`.
   Take the user, password and database from the worktree `.env`. Do not print them.
3. Add one line to the worktree `.env`: `DM_FAKE_SCRIPT=greyhollow-live`.
4. Recreate the app container so it reads the new value:
   `docker compose -p stacks-<env> up -d --force-recreate --wait app`.
5. Check the boot log: `docker compose -p stacks-<env> logs app | grep "DM script mode"`.
   Expect `DM script mode: greyhollow-live (7 calls, 1 dice)`, or the counts the shipped script has.
6. Create an operator account inside the app container
   (`docker compose -p stacks-<env> exec app node dist/cli/create-operator.js`, the built form of
   `pnpm auth:create-operator`). Keep the test
   password in an untracked file outside the repo.
7. Start the scene: run `node specs/053-env-fake-dm-script/evidence/start-scene.mjs`. It signs
   in as the operator, seats the operator on every human character of `greyhollow-ford`, calls
   `POST /dm/sessions/<id>/start`, and prints the play and debug URLs.
8. Open the play URL in Brave. Expect the scripted opening narration within a few seconds.
9. Open the debug URL. Expect a `done` scene-start turn job. Select it; its written events
   highlight in the log.
10. Optional player-action turn: run `node specs/053-env-fake-dm-script/evidence/declare.mjs <sessionId>`.
    It declares and commits `act-search` for Tamsin over the WebSocket. Expect a d20 of 14
    against DC 13, a success, and the scripted narration.
11. Any further DM call fails loudly with `unscripted call for <purpose>`. Recreate the app
    container (step 4) to reload the script.
12. To leave script mode, delete the line from the worktree `.env` and repeat step 4.

## Expected refusals

- `STACKS_ENV` is `default`, `main` or `dev`, or unset: boot fails and names `DM_FAKE_SCRIPT`.
- An unknown name: boot fails and lists the available names.
