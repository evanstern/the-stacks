# Research — 010 per-worktree compose stacks

Each decision below is settled for implementation. Source of truth: `backlog/docs/doc-0002`
(ratified 2026-09-28).

## R1 — One script, stdlib only, no new dependency

**Decision:** `scripts/env.mjs`, plain ESM run by Node 22, using only `node:child_process`,
`node:fs`, `node:net`, `node:path`, `node:crypto`. It shells out to the `docker` and `git`
CLIs. Root `package.json` gains `env:*` scripts that call it.

**Why:** the ladder — stdlib and the already-installed Docker CLI cover every verb. The
sibling `scripts/check-boundaries.mjs` sets the pattern (plain `.mjs`, stdlib, `spawnSync`).
Node's `--test` runner is already used for `.claude/hooks/*.test.mjs`, so the tests need no
framework either.

**Rejected:** a TypeScript script under `apps/server/scripts/` (it would pull a Docker
concern into the server package); a compose SDK package (a dependency for what `spawnSync`
does in a few lines).

## R2 — Project name and env name

**Decision:** `env` = basename of the worktree's toplevel (`git rev-parse --show-toplevel`),
lowercased, with any character outside `[a-z0-9-]` replaced by `-`. Project =
`stacks-<env>`. The local main stack uses `env = main`. `dev` is reserved for vm-104
(TASK-0021); `up` refuses the names `main` and `dev` from a worktree, and refuses to run from
the root checkout (root is read-only; its stack is `pnpm env:main`).

**Why:** compose prefixes every container, network, and volume with the project name, so the
name alone isolates resources. Basename is what doc-0002 names.

## R3 — Port derivation (plan item c)

**Decision:**
- `task-<n>` worktrees: app = `3000 + n`, db = `15000 + n` (doc-0002's table). `task-0020` →
  3020 / 15020.
- Any other worktree name: `n = 1000 + (sha256(env) mod 8000)` → app 4000–11999,
  db 16000–23999. Deterministic, disjoint from the `task-<n>` range for n < 1000.
- `main`: app 3000, db 5432 — the compose file's existing defaults.
- `n` from `task-<n>` must be 1–999; otherwise fall back to the hashed range.

`up` probes both ports with `net.createServer().listen(port, '127.0.0.1')` before starting,
and refuses naming the port if either is bound (FR-005). A collision between two hashed
names is therefore caught, not silent.

**Why:** doc-0002 fixes the task formula. The fallback keeps non-task worktrees (like
`sweep-m1-wave1`) working without a registry file.

## R4 — Labels, and the commit in `/health`

**Decision:** labels go on both services in `docker-compose.yml`, read from env:

```yaml
labels:
  org.the-stacks.env: ${STACKS_ENV:-default}
  org.the-stacks.worktree: ${STACKS_WORKTREE:-}
  org.the-stacks.commit: ${STACKS_COMMIT:-unknown}
```

`env.mjs up` exports `STACKS_ENV`, `STACKS_WORKTREE` (absolute path), and `STACKS_COMMIT`
(`git rev-parse HEAD`) into the compose process environment. A plain `docker compose up`
(self-hoster path) still works: labels fall back to `default` / empty / `unknown`.

The commit reaches `/health` through a build arg: the `app` service gets
`build.args.GIT_COMMIT: ${STACKS_COMMIT:-unknown}`, the Dockerfile runtime stage declares
`ARG GIT_COMMIT=unknown` and `ENV GIT_COMMIT=$GIT_COMMIT`, and `loadConfig` reads
`GIT_COMMIT` (default `"unknown"`). `HealthReport` gains `commit: string`. Existing fields and
always-200 behavior are unchanged (FR-007). This is an additive change to the fixed
`contracts/health.md` seam of spec 003; `contracts/health.md` here records the new field.

**Why build arg, not runtime env:** the commit belongs to the image, not the container. A
runtime env could claim a commit the image was not built from. The `.git` directory is not in
the build context's runtime layer, so reading it at runtime is not an option.

**Dirty trees:** when `git status --porcelain` is non-empty, `STACKS_COMMIT` gets a
`-dirty` suffix so `/health` does not claim a clean commit.

## R5 — `.env` per worktree

**Decision:** `up` reads `.env.example`, reads an existing `.env` if present, and writes `.env`
with operator keys preserved and these keys set from derivation: `APP_PORT`, `DB_PORT`,
`STACKS_ENV`. `DATABASE_URL` keeps the `db` service host (inside the compose network) and
`TEST_DATABASE_URL` is set to `postgres://…@localhost:<DB_PORT>/…` so host-run integration
tests reach this stack's database. Credentials come from `.env.example` defaults unless the
operator set them.

`.env` is already gitignored.

## R6 — Orphan detection

**Decision:** `status` and `prune` list containers with
`docker ps -a --filter label=org.the-stacks.env --format '{{json .}}'`, group by the compose
project label, and read `org.the-stacks.worktree`. A stack is an orphan when its env is not
`main` or `dev` and its worktree path is not in `git worktree list --porcelain`. `prune` runs
`docker compose -p <project> down -v` for each orphan. Volumes and networks follow from the
project-scoped `down -v`.

Exit codes for `prune --check`: `0` no orphans, `1` orphans found (named on stdout), `2`
environment error (Docker unreachable, not a git repo). Code `2` is never `0` (FR-015).

**Why worktree list, not `fs.existsSync`:** a directory can survive its worktree
registration (a failed `git worktree remove`), and a registered worktree is the unit the
sweep owns.

## R7 — Stop hook and sweep gate (plan item a)

**Decision:**
- `.claude/hooks/env-orphan-hook.mjs`: runs `node scripts/env.mjs prune --check`; on exit 1
  prints a warning naming the orphans to stderr and **exits 0** (warn, never block — the
  runbook's Stop-hook note). On exit 2 (Docker down) it is silent and exits 0; an unreachable
  Docker is not an orphan signal.
- `.claude/settings.json` gains a `Stop` entry for that hook. The two `PreToolUse` root-guard
  entries stay byte-identical (plan item b); a test asserts it.
- The sweep gate lands in this repo, not the plugin: a new "Runtime stacks" section in
  `CLAUDE.md` **outside** the `pdlc:grounding` markers (so `pdlc:bootstrap` refreshes never
  erase it) stating: run `pnpm env:prune --check` at sweep start and before removing any
  worktree; run `pnpm env:down` before `git worktree remove`. The M1 wave-1 runbook's
  per-PR gate list gains the same two lines.
- The plugin change (the sweep skill running `env prune --check` natively) is filed upstream
  separately, out of this task's scope. The PR records that it was filed.

**Why:** the sweep procedure lives in the praxisflux plugin, which this repo does not own.
CLAUDE.md is always-on context, so the rule holds whether or not the plugin learns it.

## R8 — `pnpm env:main` (plan item d)

**Decision:** a dedicated detached worktree at `.worktrees/env-main`:
1. `git fetch origin main`.
2. If `.worktrees/env-main` does not exist: `git worktree add --detach .worktrees/env-main
   origin/main`. Otherwise, inside it: `git checkout --detach origin/main` and
   `git reset --hard origin/main` and `git clean -fdx -e .env`.
3. Run `up` from that worktree with `env = main` and ports 3000 / 5432.

`env down main` runs `docker compose -p stacks-main down -v` and removes the
`.worktrees/env-main` worktree.

The root checkout is never touched: no checkout, no reset, no index change. The root-guard
allows `git worktree add` and fetch at root; the reset and clean run inside the `env-main`
worktree, which the guard treats as a worktree (not root).

`env-main` is registered in `git worktree list`, so the main stack is also never an orphan by
the R6 rule, and R6 additionally exempts `main` by name.

**Why:** fresh `origin/main` without disturbing root, and one build directory reused across
runs so Docker's layer cache stays warm.

**Rejected:** `git archive` into a temp dir (no layer cache between runs, and a temp path in
the label that disappears — which would read as an orphan).

## R9 — The no-leftovers test (AC #5)

**Decision:** `scripts/env.test.mjs` (Node `--test`). It creates a throwaway worktree
`.worktrees/env-selftest-<pid>`, runs `up`, asserts `/health` answers with the worktree's
commit, runs `down`, then asserts `docker ps -a`, `docker network ls`, and `docker volume ls`
each return zero entries filtered by `label=com.docker.compose.project=stacks-env-selftest-<pid>`,
then removes the worktree. A second case runs `prune --check` against a deleted worktree's
stack and asserts exit 1, then `prune`, then exit 0.

The test skips with a visible reason when Docker is unreachable. It is wired as
`pnpm check:env` and **not** added to `ci:check`: CI's runner has no Docker-in-Docker today,
and a stack build costs minutes. The PR records a local run as evidence. Unit tests of the
pure functions (name/port derivation, `.env` merge, orphan classification) run in
`ci:check` via `check:hooks`-style Node tests with no Docker.

**Why:** the card requires proof, and only a real Docker run proves it. The pure logic is
where most bugs live, and that part runs everywhere.
