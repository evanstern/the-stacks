# Contract — `scripts/env.mjs` (the `pnpm env:*` commands)

Run from a worktree (or, for `main`/`status`/`prune`, from anywhere in the repo).
Non-interactive. Output is human-readable lines; exit codes are the machine contract.

Amended by spec 020 (test compose stack): `up` and `down` now also manage a per-worktree
throwaway test database stack, `stacks-<env>-test`. `status`/`prune`/`prune --check` needed
no code change — a test stack is just another labeled project to them.

| Command | pnpm alias | Does | Exit |
|---|---|---|---|
| `env.mjs up` | `pnpm env:up` | Derive env, project, test project, ports for this worktree; refuse from root, for reserved names, or for a name ending in `-test`; probe app, db, and test-db ports; write `.env`; `docker compose -p stacks-<env>-test -f docker-compose.test.yml up -d --wait`; then `docker compose -p stacks-<env> up -d --build --wait` with labels and build arg | 0 both healthy · 1 refused or failed · 2 environment error |
| `env.mjs down [main]` | `pnpm env:down` | `down -v --remove-orphans` for `stacks-<env>-test` (via `docker-compose.test.yml`), then `stacks-<env>`. With `main`: the local main stack only, then remove `.worktrees/env-main` | 0 (also when either or both were absent) · 2 |
| `env.mjs status` | `pnpm env:status` | One line per labeled stack: env, project, worktree, branch, commit, ports, `ORPHAN` marker (a test stack lists as its own project) | 0 · 2 |
| `env.mjs prune` | `pnpm env:prune` | `down -v` every orphan; print each removed | 0 · 2 |
| `env.mjs prune --check` | `pnpm env:prune --check` | Report orphans, change nothing | 0 none · 1 orphans (named) · 2 environment error |
| `env.mjs main` | `pnpm env:main` | Fetch `origin/main`; create or refresh detached worktree `.worktrees/env-main`; `up` it as env `main` on 3000/5432, no test stack | as `up` |

## Derivation

| Worktree basename | env | project | test project | app port | db port | test db port |
|---|---|---|---|---|---|---|
| `task-<n>`, 1 ≤ n ≤ 999 | `task-<n>` | `stacks-task-<n>` | `stacks-task-<n>-test` | 3000+n | 15000+n | 25000+n |
| any other name | sanitized name | `stacks-<name>` | `stacks-<name>-test` | 3000+k | 15000+k, k = 1000 + sha256(name) mod 8000 | 25000+k |
| `env-main` (via `main`) | `main` | `stacks-main` | none | 3000 | 5432 | none |

Reserved: `main`, `dev` (vm-104's, TASK-0021), and any env ending in `-test` — it would
collide with its own worktree's test project (spec 020 R9).

## `.env` keys written by `up`

`APP_PORT`, `DB_PORT`, `STACKS_ENV`, and (all worktrees but `env:main`) `TEST_DB_PORT` and
`TEST_DATABASE_URL=postgres://stacks:stacks@localhost:<TEST_DB_PORT>/stacks` — the test
stack's fixed, throwaway credentials, never the app database's (spec 020 R5).

## Labels (every container)

`org.the-stacks.env`, `org.the-stacks.worktree` (absolute path), `org.the-stacks.commit`.
The test stack's container inherits these from `docker-compose.yml` via `extends`.

## Orphan rule

A labeled stack whose env is not `main`/`dev` and whose worktree path is absent from
`git worktree list --porcelain`. A worktree's app and test stacks are separate compose
projects and are classified (and pruned) independently.

## `docker-compose.test.yml` (spec 020)

- Top-level `name: stacks-test` (hand-run and CI default project).
- One service, `db`: `extends` `docker-compose.yml`'s `db`; `env_file: !reset []`;
  `environment` literals `POSTGRES_USER/PASSWORD/DB = stacks`; `volumes: !reset []`;
  `tmpfs: [/var/lib/postgresql/data]`; `ports: !override ["127.0.0.1:${TEST_DB_PORT:-5433}:5432"]`.
- Names no image — the pgvector pin lives once, in `docker-compose.yml`.
