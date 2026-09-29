---
description: "Tasks for 010 — per-worktree compose stacks with orphan gates"
---

# Tasks: Per-worktree compose stacks with orphan gates

**Input**: `specs/010-worktree-stacks/` — spec.md, plan.md, research.md (R1–R9), data-model.md,
contracts/env-cli.md, contracts/health.md.

**Tests**: required — AC #5 demands a no-leftovers test; the pure logic gets unit tests that
run in `ci:check`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — pure derivation library

**Purpose**: the logic every verb depends on, tested without Docker.

- [x] T001 Create `scripts/env-lib.mjs` (stdlib only, ESM) exporting pure functions per
  research R2/R3/R5/R6 and data-model.md: `deriveIdentity({ toplevel, rootToplevel })` →
  `{ env, project, appPort, dbPort }` (throws on root checkout and on reserved `main`/`dev`
  from a worktree); `mainIdentity()` → env `main`, 3000/5432; `mergeEnvFile(exampleText,
  existingText, derived)` → text, derived keys win, operator keys preserved, comments from
  `.env.example` kept; `classifyStacks(runningStacks, worktreePaths)` → adds `orphan`;
  `parseWorktreeList(porcelain)` → absolute paths.
- [x] T002 [P] Create `scripts/env-lib.test.mjs` (Node `--test`) covering: `task-0020` →
  3020/15020; `task-7` → 3007/15007; `task-1000` and `sweep-m1-wave1` → hashed range
  4000–11999 / 16000–23999, deterministic across calls; uppercase and odd characters
  sanitized; root and reserved names refused; `.env` merge keeps operator `POSTGRES_PASSWORD`
  and overwrites a stale `APP_PORT`; orphan classification exempts `main` and `dev`.
- [x] T003 In root `package.json`, extend `check:hooks` (or add `check:scripts` and append it
  to `ci:check`) so `scripts/*lib.test.mjs` runs in `ci:check`. `pnpm ci:check` passes.

**Checkpoint**: derivation is proven; nothing touches Docker yet.

## Phase 2: User Story 1 — isolated stack per worktree (Priority: P1) 🎯 MVP

**Goal**: `up` and `down` give each worktree its own labeled stack; `/health` names the commit.

**Independent Test**: two worktrees up at once on distinct ports; one down leaves the other
healthy and leaves nothing of itself behind.

- [ ] T004 [P] [US1] `docker-compose.yml`: add `labels` (`org.the-stacks.env`,
  `org.the-stacks.worktree`, `org.the-stacks.commit`, from `STACKS_ENV`, `STACKS_WORKTREE`,
  `STACKS_COMMIT` with defaults `default`/empty/`unknown`) to both `app` and `db`; change
  `app.build` to the long form with `args.GIT_COMMIT: ${STACKS_COMMIT:-unknown}`. Keep every
  existing comment. Plain `docker compose config` from a clean clone must still validate.
- [ ] T005 [P] [US1] `Dockerfile` runtime stage: `ARG GIT_COMMIT=unknown` and
  `ENV GIT_COMMIT=$GIT_COMMIT`, placed after the dependency install so the arg does not bust
  the install layer cache.
- [ ] T006 [P] [US1] Server: `apps/server/src/config.ts` adds `commit: string` read from
  `GIT_COMMIT` (default `"unknown"`); `routes/health.ts` adds `commit` to `HealthReport` and
  the response per `contracts/health.md`; thread it through `app.ts`/`index.ts` without
  changing any other route. `apps/server/test/health.test.ts` asserts `commit` is present, is
  `"unknown"` by default, and does not affect `status`. Update any `loadConfig` test.
- [ ] T007 [P] [US1] `.env.example`: document `STACKS_ENV` and state that `pnpm env:up`
  writes `APP_PORT`, `DB_PORT`, `STACKS_ENV`, and `TEST_DATABASE_URL` for the worktree.
- [ ] T008 [US1] Create `scripts/env.mjs` with verbs `up` and `down` per
  `contracts/env-cli.md`: resolve toplevel via `git rev-parse --show-toplevel` and root via
  `git rev-parse --path-format=absolute --git-common-dir`; derive identity (T001); probe both
  ports on 127.0.0.1 with `node:net` and refuse naming a bound port; write `.env` (T001
  merge); compute `STACKS_COMMIT` (`-dirty` when `git status --porcelain` is non-empty); run
  `docker compose -p <project> up -d --build --wait`; print project, URLs, and commit. `down`
  runs `docker compose -p <project> down -v --remove-orphans` and succeeds when nothing runs.
  Docker unreachable → one message, exit 2.
- [ ] T009 [US1] Root `package.json`: add `env:up`, `env:down`, `env:status`, `env:prune`,
  `env:main` scripts calling `node scripts/env.mjs <verb>`; confirm `pnpm env:prune --check`
  forwards the flag.
- [ ] T010 [US1] Manual proof, recorded in the task's board notes: from this worktree and a
  scratch worktree, both `pnpm env:up` at once; both `/health` report `ok` with their own
  commit; `pnpm env:down` in one; the other still `ok`.

**Checkpoint**: parallel lanes can each run their own database.

## Phase 3: User Story 2 — orphans found, gated, and warned (Priority: P2)

**Goal**: `status`, `prune`, `prune --check`, the Stop hook, and the sweep gate lines.

**Independent Test**: stack up, worktree deleted, `prune --check` exits 1 naming it; `prune`
removes it; `prune --check` exits 0.

- [ ] T011 [US2] `scripts/env.mjs`: add `status` and `prune [--check]` per research R6 and
  the contract's exit codes (0/1/2). `status` prints one line per stack with `ORPHAN` marked.
- [ ] T012 [US2] Create `scripts/env.test.mjs` (Node `--test`, per research R9): case 1 —
  throwaway worktree `.worktrees/env-selftest-<pid>`, `up`, `/health` commit equals the
  worktree HEAD, `down`, then zero containers, networks, and volumes with
  `label=com.docker.compose.project=<project>`; case 2 — `up`, remove the worktree, `prune
  --check` exits 1 naming it, `prune`, `prune --check` exits 0. Skip with a visible reason when
  Docker is unreachable. Always clean up in `after`. Add root script `check:env` running it;
  do NOT add it to `ci:check`.
- [ ] T013 [P] [US2] Create `.claude/hooks/env-orphan-hook.mjs` per research R7: runs
  `node scripts/env.mjs prune --check`; on exit 1 writes a warning naming the orphans to
  stderr; always exits 0. Create `.claude/hooks/env-orphan-hook.test.mjs`: warn-only on a stub
  exit 1, silent on exit 2, and `.claude/settings.json`'s `hooks.PreToolUse` equals the
  pre-change value (the two root-guard entries, byte-identical).
- [ ] T014 [US2] `.claude/settings.json`: add a `Stop` hook entry running
  `node "$CLAUDE_PROJECT_DIR/.claude/hooks/env-orphan-hook.mjs"`. Do not touch `PreToolUse`.
- [ ] T015 [P] [US2] `CLAUDE.md`: add a "Runtime stacks" section **after** the
  `<!-- pdlc:grounding END -->` marker (outside every marker) stating, as procedural prose:
  run `pnpm env:up` in a worktree that needs a database; run `pnpm env:down` before `git
  worktree remove`; run `pnpm env:prune --check` at sweep start and after post-merge cleanup;
  a nonzero exit blocks until the orphan is removed. Point at `specs/010-worktree-stacks/
  contracts/env-cli.md`.
- [ ] T016 [P] [US2] `docs/design/m1-wave1-sweep-runbook.md` per-PR gates: add the two gate
  lines from T015 (sweep start; before worktree removal).

**Checkpoint**: an orphan cannot go unnoticed.

## Phase 4: User Story 3 — local main on demand (Priority: P3)

**Goal**: `pnpm env:main` and `env down main` per research R8.

**Independent Test**: `pnpm env:main` → `/health` commit equals `git rev-parse origin/main`;
root `git status` unchanged; `pnpm env:down main` → nothing left, `env-main` worktree gone.

- [ ] T017 [US3] `scripts/env.mjs`: add `main` — `git fetch origin main`; create
  `.worktrees/env-main` with `git worktree add --detach … origin/main` or, when present,
  inside it `git checkout --detach origin/main`, `git reset --hard origin/main`,
  `git clean -fdx -e .env`; then `up` with `mainIdentity()`. `down main` downs `stacks-main`
  and runs `git worktree remove --force .worktrees/env-main`. No command runs with cwd = root
  except `fetch` and `worktree add/remove`.
- [ ] T018 [US3] Manual proof, recorded in board notes: root `git status --porcelain` output
  identical before and after `pnpm env:main`; `/health` commit equals `origin/main`; after
  `pnpm env:down main`, `pnpm env:status` shows nothing and `git worktree list` has no
  `env-main`.

## Phase 5: Polish & re-ground

- [ ] T019 Run `pnpm ci:check` and `pnpm check:env`; paste both results into the PR body.
- [ ] T020 Run `/grounding-wiki:wiki-update`. Expected NEEDS-REVIEW: `compose-stack`,
  `health-check`, `configuration`, `container-image`. Add a note for the env tooling. The
  freshness gate (`gates/cli.mjs freshness . docs/wiki`) prints `OK`.
- [ ] T021 File the praxisflux upstream request (the sweep skill runs `env prune --check`
  natively) and record its link in the PR body (research R7).

## Dependencies & Execution Order

- Phase 1 blocks all others. T004–T007 are parallel; T008 needs T001, T004, T005.
- Phase 3 needs T008. Phase 4 needs T008. Phases 3 and 4 are independent of each other.
- Phase 5 last.

## Implementation Strategy

MVP is Phases 1–2: it unblocks TASK-0022 and every later lane. Phases 3–4 complete the card.
