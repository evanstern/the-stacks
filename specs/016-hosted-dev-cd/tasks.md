---
description: "Tasks for 016 — hosted dev on vm-104 with CD from main"
---

# Tasks: Hosted dev environment on vm-104 with CD from main

**Input**: `specs/016-hosted-dev-cd/` — spec.md, plan.md (incl. "Operator checkpoints"),
research.md (R1–R9), data-model.md, contracts/deploy-cli.md, contracts/workflows.md,
quickstart.md.

**Tests**: required for the pure logic and the workflow invariants (runbook gate: the deploy
job never runs for `pull_request`). The Docker path is proven live on vm-104.

**Hard rules for every implementer**:

- Never open, print, or copy `/home/stacks/dev/.env`. Never commit a secret.
- On vm-104, run only as `stacks`, never with sudo, and touch nothing outside project
  `stacks-dev` and `/home/stacks`. The three commands under plan.md "Operator checkpoints"
  run only after the operator says yes.
- No verb, script, or runbook step may run `docker compose down` or pass `-v`/`--volumes`
  against `stacks-dev`, except the runbook's operator-confirmed "Destroy" section.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — pure deploy logic and workflow invariants

**Purpose**: the decisions every verb depends on, tested without Docker, in `ci:check`.

- [x] T001 Create `scripts/deploy-lib.mjs` (stdlib only, ESM) exporting pure functions per
  research R2, R6, R7, R8: `deployDecision({ sha, mainHead, allowStale })` →
  `"deploy" | "skip"`; `healthMatches(body, sha)` → true only when `body.status === "ok"`
  and `body.commit === sha`; `driftVerdict({ expected, observed, expectedAgeMin, graceMin = 30 })`
  → `"ok" | "pending" | "drift"` (unreachable `observed === null` is `drift`);
  `tagsToPrune(images, keep = 3)` → tags to remove, newest `keep` by creation time kept, input
  from `docker image ls --format json`; `renderDevEnv(exampleText, password)` → secrets-file
  text with `APP_PORT=3000`, `DB_PORT=5432`, `STACKS_ENV=dev`, `POSTGRES_PASSWORD`, and a
  matching `DATABASE_URL=postgres://stacks:<pw>@db:5432/stacks` (reuse `mergeEnvFile` from
  `scripts/env-lib.mjs` if it fits).
- [x] T002 [P] Create `scripts/deploy-lib.test.mjs` (Node `--test`) covering every branch of
  T001, plus workflow invariants read as text from `.github/workflows/`: `deploy-dev.yml` and
  `drift-dev.yml` contain no `pull_request` / `pull_request_target` trigger;
  `deploy-dev.yml` contains the exact job guard from contracts/workflows.md; `ci.yml`
  contains no `self-hosted`. (The workflow assertions fail until T005/T012 land; write them
  now and let them go green then.)
- [x] T003 Confirm the existing `check:scripts` glob (`scripts/*lib.test.mjs`) picks up the
  new test; `pnpm check:scripts` passes except the T002 workflow assertions pending T005.

**Checkpoint**: deploy decisions proven; nothing touches Docker yet.

## Phase 2: User Story 1 — main is always running on dev (P1) 🎯 MVP

**Goal**: a green CI push to `main` deploys to `stacks-dev`, migrates, and verifies `/health`.
Data persists. (AC #1, AC #2)

**Independent Test**: quickstart.md §1.

- [x] T004 [P] [US1] Create `deploy/dev/compose.dev.yml` per research R3 and R5:
  `app.image: stacks-dev-app:${STACKS_COMMIT}`; `app.build.labels` and the `migrate` build
  labels `org.the-stacks.env: dev`; `app.ports: !override ["127.0.0.1:${APP_PORT}:${APP_PORT}"]`;
  `app.env_file` and `db.env_file` `!override` to `${DEV_ENV_FILE:-/home/stacks/dev/.env}`;
  a `migrate` service (`profiles: [migrate]`, `build: { context: ., target: build }`,
  `image: stacks-dev-migrate:${STACKS_COMMIT}`, `working_dir: /app/apps/server`,
  `env_file` as above, `environment: { TEST_DATABASE_URL: "" }`,
  `command: ["node", "--experimental-strip-types", "scripts/migrate.ts"]`,
  `depends_on: { db: { condition: service_healthy } }`, the three `org.the-stacks.*` labels).
  Header comment: vm-104 only; never needed by a self-hoster. Validate locally with a
  throwaway env file: `docker compose -p stacks-dev -f docker-compose.yml -f
  deploy/dev/compose.dev.yml --env-file <tmp> config` succeeds, and `docker compose config`
  on the base file alone is unchanged from `origin/main`.
- [x] T005 [P] [US1] Create `.github/workflows/deploy-dev.yml` exactly per
  contracts/workflows.md: `workflow_run` on `[CI]` completed, branches `[main]`;
  `workflow_dispatch` inputs `commit` and `force_unhealthy`; the job guard; `runs-on:
  [self-hosted, vm-104]`; `concurrency: { group: deploy-dev, cancel-in-progress: false }`;
  `permissions: { contents: read }`; `timeout-minutes: 30`; `actions/checkout@v4` with
  `ref` = dispatch `commit` or `github.event.workflow_run.head_sha` (or `main` for a bare
  dispatch) and `fetch-depth: 1`; one step running
  `node scripts/deploy-dev.mjs deploy "$(git rev-parse HEAD)"` with `--allow-stale` when the
  `commit` input is set and `--force-unhealthy` when that input is true. Pass inputs through
  `env:`, never inline `${{ }}` into the shell (injection hygiene).
- [x] T006 [US1] Create `scripts/deploy-dev.mjs` (stdlib, ESM, `spawnSync` style of
  `scripts/env.mjs`) with verbs `deploy`, `status`, and `init-secrets` per
  contracts/deploy-cli.md and research R4, R6 steps 1–8 and 10 (success path). `init-secrets`
  creates `/home/stacks/dev` (`0700`) and the file (`0600`) with
  `crypto.randomBytes(24).toString("hex")`, refuses if the file exists, prints only the path,
  and needs no Docker. `deploy` passes `STACKS_ENV=dev`, `STACKS_WORKTREE=<checkout>`,
  `STACKS_COMMIT=<sha>` in the compose environment; backs up before migrating (skip on an
  empty stack); verifies with `healthMatches` against `http://127.0.0.1:3000/health`
  (3 s interval, 180 s deadline); prunes with `tagsToPrune` and
  `docker image prune -f --filter label=org.the-stacks.env=dev`. Exit codes per the contract.
  Never echo the env file; never `set -x`-equivalent logging of compose's environment.
- [x] T007 [US1] **Operator checkpoint 1** (plan.md): name the `init-secrets` command, stop,
  and run it only after a yes (or hand it to the operator). Record on the card: the path
  printed, and nothing else.
- [x] T008 [US1] Pre-merge proof on vm-104, as `stacks`, from a clone of this branch under
  `/home/stacks/dev/proof` (removed afterwards): **announce to the operator first**
  (checkpoint 3), then `node scripts/deploy-dev.mjs deploy $(git rev-parse HEAD)
  --allow-stale`. Expect exit 0 and `curl -s 127.0.0.1:3000/health` naming that commit.
  Create one invitation or account, deploy a second time, confirm it survived (AC #1
  persistence). Record the outputs in the card notes.

**Checkpoint**: `dev` runs a named commit with persistent data. MVP reached.

## Phase 3: User Story 2 — a bad deploy never takes dev down (P1)

**Goal**: build, migration, or health failure leaves the previous version serving and fails
the job. (AC #3)

**Independent Test**: quickstart.md §2.

- [x] T009 [P] [US2] Create `deploy/dev/compose.force-unhealthy.yml` setting only
  `app.environment.DATABASE_URL: postgres://unreachable@127.0.0.1:1/none`, with a header
  comment naming FR-012 and saying it is never used for a real deploy.
- [x] T010 [US2] Extend `deploy` in `scripts/deploy-dev.mjs` with research R6 step 9: on a
  verify timeout, recreate `app` at `STACKS_COMMIT=<prev>` **without** the force-unhealthy
  file and with `--no-build`, verify `<prev>`, print `dev is serving <prev>`, exit 1; with no
  `<prev>`, print `first deploy failed; dev is not serving`, exit 1. Build and migrate
  failures exit 1 before the swap and print `dev is serving <prev>`. `--force-unhealthy` adds
  the T009 file to the swap only.
- [x] T011 [US2] Pre-merge proof: **announce first**, then from the T008 clone run
  `deploy $(git rev-parse HEAD) --allow-stale --force-unhealthy` after making a trivial
  local commit so the sha differs from the serving one. Expect exit 1, last line
  `dev is serving <T008 sha>`, and `/health` reporting `ok` with that sha. Record outputs.

**Checkpoint**: rollback proven on the real host before merge.

## Phase 4: User Story 3 — drift is caught (P2)

**Goal**: an hourly check fails when `dev` lags `main` HEAD past the grace window. (AC #4)

**Independent Test**: quickstart.md §3.

- [x] T012 [P] [US3] Create `.github/workflows/drift-dev.yml` per contracts/workflows.md:
  `schedule: - cron: '17 * * * *'`, `workflow_dispatch`, `runs-on: [self-hosted, vm-104]`,
  `concurrency: { group: drift-dev, cancel-in-progress: true }`,
  `permissions: { contents: read }`, checkout `ref: main` depth 1, then
  `node scripts/deploy-dev.mjs drift`.
- [x] T013 [US3] Add the `drift` verb to `scripts/deploy-dev.mjs`: expected =
  `git rev-parse HEAD`, age from `git log -1 --format=%ct`, observed from `/health`
  (5 s timeout; unreachable → `null`), verdict via `driftVerdict`; print expected, observed,
  and verdict; exit per contracts/deploy-cli.md.
- [x] T014 [US3] Pre-merge proof from the T008 clone: `drift` against the serving commit →
  exit 0 `ok`; checkout an older commit whose committer time is > 30 min old and run
  `drift` → exit 1 naming both commits. Record outputs.

## Phase 5: User Story 4 — only the tailnet reaches dev (P2)

**Goal**: HTTPS on the tailnet, nothing on the LAN. (AC #5)

**Independent Test**: quickstart.md §4.

- [x] T015 [US4] **Operator checkpoint 2** (plan.md): name the exact command
  `docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:3000`, stop,
  and run it only after a yes. If it reports HTTPS certificates are disabled, stop and ask
  the operator to enable them. Record `tailscale serve status` output on the card.
- [x] T016 [US4] Verify from the operator's Mac: `curl -sI
  https://vm-104.tailb3c1b6.ts.net:8443/health` → 200 with no certificate error;
  `nc -vz -w3 vm-104.local.infinity-node.win 3000` and `... 5432` → refused. Record outputs.

## Phase 6: User Story 5 — the ops runbook (P3)

**Goal**: deploy, rollback, backup, and restore by the book. (AC #6)

**Independent Test**: quickstart.md §5.

- [x] T017 [US5] Add `backup [--name <label>]` and `restore <file> --yes` verbs to
  `scripts/deploy-dev.mjs` per contracts/deploy-cli.md (`pg_dump -Fc` / `pg_restore --clean
  --if-exists` through `docker compose exec -T db`, using the db container's own
  `POSTGRES_USER`/`POSTGRES_DB` env; `manual-*` backups are never auto-pruned; `restore`
  stops `app`, restores, starts `app` at its current image, verifies `/health`).
- [x] T018 [US5] Write `docs/ops/dev-vm-104.md` in procedural prose (one instruction per
  sentence, imperative): What runs where (project, ports, volume, secrets path, backup
  path, URL); Deploy (merge, or `gh workflow run deploy-dev.yml`); Rollback to a named
  commit (`gh workflow run deploy-dev.yml -f commit=<sha>`; expect drift until the next
  deploy); Backup; Restore; Inspect (`deploy-dev.mjs status`, `docker compose ... ps/logs`);
  Secrets (how the operator adds a model key to `/home/stacks/dev/.env` by hand, then
  redeploys); Exposure (the `tailscale serve` command and its undo); Destroy (the only place
  `down -v` appears, marked operator-only with a backup first); Failure triage (what each
  deploy exit line means).
- [x] T019 [US5] Follow the runbook's Backup and Rollback sections once against `dev` from the
  T008 clone (rollback by the script verb, since the workflows are not on `main` yet); record
  outputs. Then redeploy the branch HEAD.

## Phase 7: Polish, re-ground, and the merge condition

- [ ] T020 Remove `/home/stacks/dev/proof` and `/home/stacks/dev/bootstrap` on vm-104. Leave
  `stacks-dev` running, the secrets file, and the backups.
- [x] T021 Run `pnpm ci:check` in the worktree; it passes, including `check:scripts` with the
  T002 workflow invariants green. Paste the result into the PR body. State in the PR body:
  the deploy workflow runs on the self-hosted runner only for pushes to `main` after CI
  succeeds, never on `pull_request` (runbook per-task artifact line).
- [x] T022 Run `/grounding-wiki:wiki-update`. Review, and re-pin honestly (edit body text
  where the note's claims changed; re-pin only when the note is still true):
  `ci-pipeline` (CI unchanged, but name the two new workflows and that `check:scripts` now
  covers `deploy-lib`), `runtime-stacks` (`dev` is now real: link the new note; reserved-name
  text), `health-check` (`/health` `commit` is now the deploy's success signal),
  `compose-stack` (the dev override exists and binds the app to loopback). Add
  `docs/wiki/hosted-dev.md` (sources: `.github/workflows/deploy-dev.yml`,
  `.github/workflows/drift-dev.yml`, `scripts/deploy-dev.mjs`, `scripts/deploy-lib.mjs`,
  `deploy/dev/compose.dev.yml`, `deploy/dev/compose.force-unhealthy.yml`,
  `docs/ops/dev-vm-104.md`) and route it from `INDEX.md`; regenerate `CAPSULES.md` if any
  `description:` changed.
- [x] T023 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs
  freshness . docs/wiki`; it prints `OK`.
- [x] T024 Merge condition (runbook "Task-specific merge conditions", TASK-0021). Record the
  pre-merge proofs (T008, T011) in the PR body. After the operator merges, and after
  **announcing** each run: (a) the merge commit's own `main` push deploys through
  `deploy-dev.yml`, and `https://vm-104.tailb3c1b6.ts.net:8443/health` reports that commit;
  (b) `gh workflow run deploy-dev.yml --ref main -f force_unhealthy=true` fails and `/health`
  still reports the commit from (a). Record both run URLs on the card and in the PR. Run
  `drift-dev.yml` once by dispatch and record its URL. The operator decides whether the
  pre-merge proofs suffice to merge (plan.md, Open questions).

## Dependencies & Execution Order

- Phase 1 blocks all others.
- Phase 2: T004, T005 parallel; T006 needs T001; T007 needs T006; T008 needs T004, T006, T007.
- Phase 3 needs T008. Phase 4 needs T001 and a running `dev` (T008). Phase 5 needs T008.
  Phases 3, 4, 5 are independent of each other.
- Phase 6 needs T008; T019 needs T017 and T018.
- Phase 7 last. T024 happens after merge and gates closing the card, not opening the PR.

## Parallel examples

- Phase 2: T004 (`deploy/dev/compose.dev.yml`) and T005 (`deploy-dev.yml`) together.
- After T008: T009, T012, T015 together (different files or no files).

## Implementation Strategy

MVP is Phases 1–3: `dev` deploys and rolls back safely, which is the merge condition. Phases
4–6 complete the card. One implementer per phase, re-grounded from this spec dir and the
branch commits; every vm-104 change outside `/home/stacks` waits for its operator checkpoint.

## Deviation (Phase 1, T002/T003)

T003 requires `pnpm check:scripts` to pass now even though the three workflow-invariant
assertions on `deploy-dev.yml`/`drift-dev.yml` can't be true until T005/T012 create those
files. Node's `test(name, { todo: "..." }, fn)` reports and runs each assertion (so it still
fails visibly today, naming the pending task) without failing the suite or `ci:check`. Whoever
lands T005/T012 should drop the `todo` option so the assertion is enforced going forward.
