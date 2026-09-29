# Tasks: Test compose stack

**Input**: Design documents from `/specs/020-test-compose/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/env-cli.md,
quickstart.md

**Tests**: required. `scripts/env-lib.test.mjs` covers the pure logic and the image-pin
guard inside `pnpm ci:check`. `pnpm check:env` covers Docker end to end, locally.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0033 && pwd && git branch --show-current` first. Expect `task-0033-test-compose`. On any other branch, STOP.
- Add no dependency. Change no file under `apps/`.
- Write the pgvector image only in `docker-compose.yml`.
- Never use the backlog MCP tools. Use the `backlog` CLI inside the worktree for any card change.
- Commit per phase with a `TASK-0033:` subject and the Co-Authored-By trailer. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US4)

## Phase 1: Foundational — derivation and the test compose file

- [ ] T001 [P] In `scripts/env-lib.mjs`, extend `derivePorts` to return `testDbPort`: `25000+n` for `task-<n>` (1 ≤ n ≤ 999), `25000+k` for hashed names (same `k`). Extend `deriveIdentity` to return `testProject: \`${project}-test\`` and `testDbPort`. Refuse a sanitized env ending in `-test` with a message naming the collision (research R9). Leave `mainIdentity()` unchanged.
- [ ] T002 [P] In `scripts/env-lib.test.mjs`, add cases: `task-0033` → `3033/15033/25033` and `stacks-task-0033-test`; `task-7` → `25007`; a hashed name → test port in 26000–33999 and `testDbPort - dbPort === 10000`; `foo-test` throws; `mainIdentity()` has no `testProject`.
- [ ] T003 [P] In `docker-compose.yml`, change `"${APP_PORT}:${APP_PORT}"` to `"${APP_PORT:-3000}:${APP_PORT:-3000}"` with a comment: `extends` interpolates this file, and CI sets no `APP_PORT` (research R1). Change nothing else.
- [ ] T004 [P] Create `docker-compose.test.yml` per contracts/env-cli.md: top-level `name: stacks-test`; one service `db` that `extends` `docker-compose.yml`'s `db`; `env_file: !reset []`; `environment` `POSTGRES_USER/PASSWORD/DB: stacks`; `volumes: !reset []`; `tmpfs: [/var/lib/postgresql/data]`; `ports: !override ["127.0.0.1:${TEST_DB_PORT:-5433}:5432"]`. Name no image. Head it with a comment citing spec 020, the ruling, and why it has no app.
- [ ] T005 In `scripts/env-lib.test.mjs`, add the image-pin guard (research R12): read `docker-compose.yml`, `docker-compose.test.yml`, every `deploy/**/*.yml`, and every `.github/workflows/*.yml` with `node:fs`; assert `pgvector/` occurs exactly once in total, in `docker-compose.yml`. The assertion message names each file that holds a hit. Depends on T004 and T007 for a green run.
- [ ] T006 Verify: `docker compose -f docker-compose.test.yml config` exits 0 with `APP_PORT` unset, and its output shows the base file's image, tmpfs, no volume, and the three `org.the-stacks.*` labels. Paste the relevant lines into the commit body.

## Phase 2: US2 — CI parity (Priority: P1)

- [ ] T007 [US2] In `.github/workflows/ci.yml`, delete the `services:` block. Add a step after checkout: `TEST_DB_PORT=5432 docker compose -f docker-compose.test.yml up -d --wait`. Keep the job `env` URLs (`stacks:stacks@localhost:5432/stacks`) and `REQUIRE_DATABASE: "1"`. Comment that the image comes from `docker-compose.yml` via the test file (spec 020 R1).
- [ ] T008 [US2] Update README "Checks" to reproduce CI with the test compose file, per quickstart.md "Reproduce CI".

## Phase 3: US1 + US3 — env machinery (Priority: P1/P2)

- [ ] T009 [US1] In `scripts/env.mjs` `runUp`: probe `testDbPort` with the app and db ports. Pass `testDbPort` to `writeEnvFile`. Start the test stack first: `docker compose -p <testProject> -f docker-compose.test.yml up -d --wait` with `composeEnv` plus `TEST_DB_PORT`; exit 1 on failure. Then start the app stack as today. Print one line naming both projects and all three ports. Skip the test stack when the identity has no `testProject` (`env:main`).
- [ ] T010 [US1] In `writeEnvFile`, derive `TEST_DB_PORT` and `TEST_DATABASE_URL=postgres://stacks:stacks@localhost:<testDbPort>/stacks` (research R5). Stop deriving it from the app credentials.
- [ ] T011 [US3] In `down` (non-main): run `down -v --remove-orphans` for `stacks-<env>-test` (with `-f docker-compose.test.yml`), then for `stacks-<env>`. Exit 0 when either was absent; exit 1 when either command fails. `down main` is unchanged.
- [ ] T012 [US3] In `scripts/env.test.mjs`, extend the end-to-end case: after `up`, assert both projects run, the test container carries the three labels, and `.env`'s `TEST_DATABASE_URL` names `testDbPort`; after `down`, assert zero labeled resources for both projects. Add a case: remove the worktree without `down`, then `prune --check` exits 1 naming `stacks-<env>-test`; then `prune` cleans it.
- [ ] T013 [US3] Fold contracts/env-cli.md's amended rows into `specs/010-worktree-stacks/contracts/env-cli.md`, with a line citing spec 020.

## Phase 4: US4 — documentation (Priority: P3)

- [ ] T014 [P] [US4] `.env.example`: rewrite the `TEST_DATABASE_URL` comment to say it points at the per-worktree **test** stack (`env:up` writes it); add `TEST_DB_PORT` with a comment; document the one-command override for migrating the app database from the host (research R7).
- [ ] T015 [P] [US4] Confirm `deploy/dev/compose.dev.yml` needs no change (it names no image). Record the check in the commit body.

## Phase 5: Verification, re-grounding, cleanup

- [ ] T016 Run `pnpm ci:check` in the worktree. Expect exit 0 and 0 skipped DB suites with `REQUIRE_DATABASE=1` against the test stack. Record the tail in `specs/020-test-compose/ci-evidence.txt`.
- [ ] T017 Run `pnpm check:env` with Docker up and no other labeled stacks. Expect all cases pass (not skipped). Record the tail in `ci-evidence.txt`.
- [ ] T018 [US1] AC #5 proof, per quickstart.md: `pnpm env:up`; migrate both databases; confirm `app` healthy; run `worker.integration.test.ts` 20 consecutive times with `REQUIRE_DATABASE=1`. Record 20/20 passes, the app container id, and the commit in `specs/020-test-compose/manual-proof.txt`. On any failure, STOP and report.
- [ ] T019 Wiki re-pin with `/grounding-wiki:wiki-update`: `runtime-stacks` (test stack, ports, `-test` reservation, backward-compat remedy; add `docker-compose.test.yml` to sources), `compose-stack` (the test file, the `APP_PORT` default, the one image home), `test-suite` (tests target the test stack; the split), `ci-pipeline` (compose step replaces `services:`), `configuration` (`TEST_DB_PORT`, `TEST_DATABASE_URL` target, migrate override). Re-verify `hosted-dev` only if the plan step flags it. Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed.
- [ ] T020 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [ ] T021 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. Expect exit 0.
- [ ] T022 Run `pnpm env:down`, then `pnpm env:prune --check`. Expect exit 0 from both.

## Dependencies

- Phase 1 blocks all others. T005 goes green only after T004 and T007.
- Phase 2 and Phase 3 are independent of each other after Phase 1.
- Phase 4 can run with Phase 3.
- Phase 5 runs last, in order T016 → T022.

## Parallel opportunities

- T001, T003, T004 touch different files.
- T014 and T015 touch different files.
