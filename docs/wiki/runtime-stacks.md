---
name: runtime-stacks
description: scripts/env.mjs — a labeled, isolated compose stack per git worktree (env up/down/status/prune/main), the pure derivation logic in env-lib.mjs, the orphan-warning Stop hook, and the local origin/main stack. Load for worktree-database, port-collision, or "why is this container still running" questions.
kind: component
sources:
  - scripts/env.mjs
  - scripts/env-lib.mjs
  - .claude/hooks/env-orphan-hook.mjs
  - .claude/settings.json
  - docker-compose.yml
  - docker-compose.test.yml
  - Dockerfile
  - apps/server/src/config.ts
  - apps/server/src/routes/health.ts
verified_against: 69b6f01a903f1b9189da332b362f2bd3cc601e71
---

# Runtime stacks

Each git worktree gets its own isolated `docker compose` stack instead of sharing one
database and one pair of host ports repo-wide (spec 010). `scripts/env.mjs` is the CLI
(`pnpm env:up|down|status|prune|main`); `scripts/env-lib.mjs` is dependency-free pure logic
(name/port derivation, `.env` merging, orphan classification) so it is unit-tested without
Docker.

## How it works

**Identity.** `deriveIdentity({ toplevel, rootToplevel })` throws if `toplevel` is the root
checkout (root is read-only for this tooling — use `main` below), if the worktree's sanitized
basename is a reserved env (`main`, `dev` — vm-104's hosted environment, now real as of
TASK-0021/spec 016; see [[hosted-dev]]), or if it ends in `-test` (spec 020 R9: `foo-test`'s
own app project would collide with `foo`'s test project — see below). Otherwise: `task-<n>`
(1 ≤ n ≤ 999) maps to the fixed range `3000+n`/`15000+n`/`25000+n` (app/db/test-db);
anything else gets a `sha256`-hashed range (`4000`–`11999`/`16000`–`23999`/`26000`–`33999`)
so an unnumbered worktree name still works with no registry — the test port is always the
db port shifted by `+10000`, so one worktree's three ports read as a triple (e.g.
`3033`/`15033`/`25033`). `env up` writes `.env` via `mergeEnvFile` (derived keys —
`APP_PORT`, `DB_PORT`, `STACKS_ENV`, `TEST_DB_PORT`, `TEST_DATABASE_URL` — always win;
operator-set keys and `.env.example`'s comments survive), probes all three ports on
`127.0.0.1` first and refuses if any is already bound, brings the [[compose-stack|test
stack]] up first (`docker compose -p stacks-<env>-test -f docker-compose.test.yml up -d
--wait`, exits 1 on failure), then runs `docker compose -p stacks-<env> up -d --build --wait`
for the app stack with `STACKS_ENV`/`STACKS_WORKTREE`/`STACKS_COMMIT` in its environment.
Those three flow into `docker-compose.yml`'s `org.the-stacks.*` container labels and the
`GIT_COMMIT` build arg (see [[compose-stack]] and [[container-image]]), which
`apps/server/src/config.ts` reads back out and [[health-check]] surfaces at `/health` —
"which build is this" is never a guess. `env down` tears the test project down first, then
the app project (`docker compose -p <project> down -v --remove-orphans` each), and succeeds
even when either or both are absent (`env:main` has no test project to tear down).

**The test stack (spec 020).** Every non-`main` worktree gets a second, DB-only compose
project, `stacks-<env>-test`, from `docker-compose.test.yml` — a database with fixed,
throwaway credentials (`stacks`/`stacks`/`stacks`) on `tmpfs`, no named volume, and no app
service, so integration tests never share a database with the worktree's own running app
(TASK-0024's worker-claims-test-jobs flake). `.env`'s `TEST_DATABASE_URL` now always points
at this test stack's port, never at the app database's credentials — see [[configuration]].
Because the reservation above refuses a worktree name ending in `-test`, `stacks-<env>-test`
can never collide with another worktree's own project name.

**Orphans.** `env status`/`env prune[--check]` list every container labeled
`org.the-stacks.env` (one entry per compose project — the test stack's own project,
`stacks-<env>-test`, is a separate entry from `stacks-<env>` even though both carry the same
`org.the-stacks.env` value) and classify a stack `ORPHAN` when its env isn't exempt (`main`,
`dev`) and its `org.the-stacks.worktree` path is absent from `git worktree list --porcelain`
— a stack left behind by a deleted worktree. A worktree removed without `env down` therefore
leaves both projects orphaned, and `prune --check` names both. `prune` tears each orphan
down; `prune --check` only reports (exit 1 naming them, 0 when clean) so it can gate without
side effects. `.claude/hooks/env-orphan-hook.mjs` runs `prune --check` as a `Stop`
hook (`.claude/settings.json`) and **only ever warns** — on exit 1 it prints the orphan list
to stderr; on exit 2 (Docker unreachable) or 0 it is silent; it always itself exits 0, so an
orphan never blocks ending a session. `CLAUDE.md`'s "Runtime stacks" section (outside the
`pdlc:grounding` markers, so plugin re-bootstraps never erase it) is where the actual gating
rule lives: run `pnpm env:prune --check` at sweep start and before removing a worktree, and
`pnpm env:down` before `git worktree remove`.

**`env main`.** A dedicated detached worktree at `.worktrees/env-main`, kept across runs so
Docker's build-layer cache stays warm: `git fetch origin main`, then either `git worktree add
--detach .worktrees/env-main origin/main` (first run) or, inside the existing worktree,
`git checkout --detach origin/main` + `git reset --hard origin/main` + `git clean -fdx -e
.env` (subsequent runs) — then the same `up` path with `mainIdentity()` (env `main`, fixed
ports 3000/5432). No command in this sequence runs with the root checkout as its cwd except
the `fetch` and the `worktree add`/`remove` themselves — the reset/clean/checkout all run
inside `.worktrees/env-main`, which is registered as its own worktree, so the root's `git
status`/`HEAD` never change. `env down main` downs `stacks-main` and
`git worktree remove --force`s that worktree. Because `env-main` is a registered worktree and
`main` is an exempt env name, the local-main stack is never flagged an orphan.

## Connections

Feeds container identity into [[compose-stack]]'s labels and [[container-image]]'s
`GIT_COMMIT` build arg, which [[configuration]] reads and [[health-check]] reports. Read
`specs/010-worktree-stacks/contracts/env-cli.md` for the full command/exit-code table.

## Operational notes

`env.mjs` exits 2 (not 1) whenever Docker itself is unreachable, distinct from exit 1
("refused" — a bound port, an unhealthy `docker compose up`, a reserved/root env) so a caller
can tell "fix Docker" apart from "fix the request." `pnpm check:env` (`scripts/env.test.mjs`,
Node `--test`, real Docker) proves the no-leftovers guarantee end to end; it is **not** part
of `pnpm ci:check` — no Docker-in-Docker in this repo's CI today — so it is run locally and
its result recorded on the task instead. `scripts/env-lib.mjs`'s unit tests
(`scripts/env-lib.test.mjs`) *are* in `ci:check` via `check:scripts` (see
[[monorepo-and-toolchain]] and [[ci-pipeline]]).
