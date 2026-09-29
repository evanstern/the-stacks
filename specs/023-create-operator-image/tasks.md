# Tasks: create-operator in the runtime image

**Input**: Design documents from `/specs/023-create-operator-image/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: `auth.integration.test.ts` gains one `hasOperator` assertion. The in-image
command is proven on a local stack (quickstart.md).

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0036 && pwd && git branch --show-current` first. Expect `task-0036-create-operator-image`. On any other branch, STOP.
- Add no dependency. Do not change `Dockerfile` or `deploy/dev/compose.dev.yml`.
- Never put a real password in a file, a commit, or a command line. Never print `.env`.
- Run no command on vm-104.
- Never use the backlog MCP tools. Use the `backlog` CLI inside the worktree for any card change.
- Commit per phase with a `TASK-0036:` subject and the Co-Authored-By trailer. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US3)

## Phase 1: US1 + US2 — compiled entry point (Priority: P1)

- [ ] T001 [US1] In `apps/server/src/auth/provisioning.ts`, export `hasOperator(db: DbClient): Promise<boolean>`: the existing `role = 'operator'` select with `limit(1)`. Make `createOperator` call it for its own check. Change nothing else in `createOperator` (research R2).
- [ ] T002 [US1] Create `apps/server/src/cli/create-operator.ts` from `apps/server/scripts/create-operator.ts` with `git mv`, then edit it. Use `.js`-suffixed imports (`../config.js`, `../db.js`, `../auth/provisioning.js`). Call `hasOperator` first and refuse before prompting, with the same message and exit code 1. Then read the password (`OPERATOR_PASSWORD`, else the prompt), keep the empty-password error, and call `createOperator`. Treat `{created: false}` as the same refusal. Keep `OPERATOR_USERNAME` (default `operator`), `TEST_DATABASE_URL || config.databaseUrl`, and `db.$client.end()` in `finally`. Replace the header comment: drop the strip-types explanation; say the file compiles into `dist` so the runtime image ships it, and keep the check-before-prompt rationale.
- [ ] T003 [US2] In `apps/server/package.json`, set `auth:create-operator` to `tsc -b && node --env-file-if-exists=../../.env dist/cli/create-operator.js` (research R3).
- [ ] T004 [P] [US2] In root `package.json`, trim `check:host-scripts` to import only `./apps/server/src/config.ts` and `./apps/server/src/db.ts` (research R4). In `apps/server/src/config.ts`, change the header comment to name only `scripts/migrate.ts` as the strip-types caller.
- [ ] T005 [P] [US1] In `apps/server/test/auth.integration.test.ts`, beside T028: assert `hasOperator(db)` is `true` after the operator exists. Keep the test's existing create-or-skip shape.
- [ ] T006 Verify: `pnpm --filter @the-stacks/server build`, then confirm `apps/server/dist/cli/create-operator.js` exists and `apps/server/scripts/` holds only `migrate.ts`. Run `grep -rn "scripts/create-operator" apps package.json` and expect no hit (wiki hits are T011's). Record both in the commit body.

## Phase 2: US3 — runbook and docs (Priority: P2)

- [ ] T007 [US3] In `docs/ops/dev-vm-104.md`, add a `## Create the first operator` section after `## Deploy`. Write procedural prose: one instruction per sentence, imperative, ~20 words maximum. Use exactly this content:

  ```markdown
  ## Create the first operator

  Do this once, after the first deploy. Dev ships with no account.

  Run this on vm-104, as `stacks`, from the checkout:
  `docker compose -p stacks-dev -f docker-compose.yml -f
  deploy/dev/compose.dev.yml --env-file /home/stacks/dev/.env exec app node
  dist/cli/create-operator.js`.

  Type the password at the `Operator password:` prompt. Never put it on the
  command line.

  Expect `Operator account created: operator`.

  Choose another username: add `-e OPERATOR_USERNAME=<name>` after `exec`.

  A second run refuses. It exits 1 and changes nothing.

  Sign in at the public URL with that username and password.
  ```

- [ ] T008 [P] [US2] In `apps/server/README.md` "Operator provisioning", keep the pnpm command. Add the in-container form, `docker compose exec app node dist/cli/create-operator.js`, for a running stack with no host toolchain.

## Phase 3: Verification, local proof, re-grounding, cleanup

- [ ] T009 Run `pnpm ci:check` in the worktree (this includes `check:host-scripts`). Expect exit 0. Record the tail in `specs/023-create-operator-image/ci-evidence.txt`.
- [ ] T010 [US1] [US2] Run quickstart.md steps 1–6 in order: build and start, confirm the entry point, migrate, create non-interactively, sign in, refuse on the second run in the exact `dev` shape, and refuse from the host command. Record each step's output (no secrets, no `.env` values), the image id, and the commit in `ci-evidence.txt`. On a hang in step 5, or any unexpected exit code, STOP and report.
- [ ] T011 Wiki re-pin with `/grounding-wiki:wiki-update`: `operator-provisioning` (new path in `sources`; the CLI now imports `hasOperator`/`createOperator`; drop the strip-types explanation; add the in-container command), `container-image` (`dist` now carries `dist/cli/create-operator.js`; the Dockerfile is unchanged), `hosted-dev` (the runbook's new section). Re-pin whatever else the freshness gate flags; expect `configuration` (source path and `config.ts`), `ci-pipeline` (`check:host-scripts`), `migrations` (`apps/server/package.json`), and `database-access` (prose names the old path). Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed.
- [ ] T012 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [ ] T013 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. Expect exit 0.
- [ ] T014 Run quickstart.md step 7: `pnpm env:down`, then `pnpm env:prune --check`. Expect exit 0 from both.

## After merge (operator steps — not tasks in this PR)

- The operator runs the runbook's "Create the first operator" command on vm-104, after the
  merge commit deploys to `dev`.
- The operator runs TASK-0030 T026 (the dev load run). Its results file is committed under
  TASK-0030 (card AC #4).

## Dependencies

- Phase 1 blocks Phase 3. Phase 2 needs only T002's path and can run beside Phase 1.
- T001 blocks T002 and T005. T002 blocks T003 and T006.
- T009–T010 block T011. T011 blocks T012.
