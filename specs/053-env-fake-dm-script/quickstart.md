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
2. Migrate the app database without reading any credential. Docker passes the env file into the
   container. `<env>` is the stack's `STACKS_ENV` (for this worktree, `task-0158`):
   ```
   docker build --target build -t stacks-<env>-migrate .
   docker run --rm --network stacks-<env>_default --env-file .env -e TEST_DATABASE_URL= \
     -w /app/apps/server stacks-<env>-migrate node --experimental-strip-types scripts/migrate.ts
   ```
   Example: `stacks-task-0158-migrate` and `--network stacks-task-0158_default`. Expect "Migrations applied."
   Also run `pnpm --filter @the-stacks/server db:migrate` to migrate the host-side test database.
3. Append one line to the worktree `.env`. Use `printf`, not `echo`: the file may lack a trailing
   newline, and a bare `echo` fuses the value onto the last line (a fused `AI_PRICES` line crashes boot):
   `printf '\nDM_FAKE_SCRIPT=greyhollow-live\n' >> .env`.
4. Recreate the app container so it reads the new value. The project name is `stacks-<env>`:
   `docker compose -p stacks-<env> up -d --force-recreate --wait app`
   (example: `-p stacks-task-0158`). Restart the app once more after step 2 if it booted before the migration.
5. Check the boot log: `docker compose -p stacks-<env> logs app | grep "DM script mode"`.
   Expect `DM script mode: greyhollow-live (9 calls, 1 dice)`.
6. Create an operator account inside the app container
   (`docker exec -e OPERATOR_PASSWORD=<generated> -e OPERATOR_USERNAME=operator stacks-<env>-app-1 node dist/cli/create-operator.js`,
   the built form of `pnpm auth:create-operator`). Generate the password randomly. Keep it in an
   untracked JSON file outside the repo: `{"username": "...", "password": "..."}`.
7. Start the scene: run `node specs/053-env-fake-dm-script/evidence/start-scene.mjs <creds-file>`. It signs
   in as the operator, seats the operator on every human character of `greyhollow-ford`, calls
   `POST /dm/sessions/<id>/start`, and prints the play and debug URLs.
8. Open the play URL in Brave. Expect the scripted opening narration within a few seconds.
9. Open the debug URL. Expect a `succeeded` scene-start turn job (and a `succeeded` chronicle job; check `dm_model_calls.outcome`, not job status). Select it; its written events
   highlight in the log.
10. Optional player-action turn: run `node specs/053-env-fake-dm-script/evidence/declare.mjs <creds-file> <sessionId>`.
    It declares and commits `act-search` for Tamsin over the WebSocket. Expect a d20 of 14
    against DC 13, a success, and the scripted narration.
11. Any further DM call (for example a second scene start) fails loudly with `unscripted call for <purpose>`. Recreate the app
    container (step 4) to reload the script.
12. To leave script mode, delete the line from the worktree `.env` and repeat step 4.

## Expected refusals

- `STACKS_ENV` is `default`, `main` or `dev`, or unset: boot fails and names `DM_FAKE_SCRIPT`.
- An unknown name: boot fails and lists the available names.
