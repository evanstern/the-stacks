# Contract — `scripts/env.mjs`, amended by 020

This amends `specs/010-worktree-stacks/contracts/env-cli.md`. Rows not listed are unchanged.
T011 folds these rows into the 010 contract, which stays the reference CLAUDE.md cites.

| Command | pnpm alias | Does | Exit |
|---|---|---|---|
| `env.mjs up` | `pnpm env:up` | Derive identity; refuse from root, for reserved names, or for a name ending in `-test`; probe app, db, and test-db ports; write `.env`; `docker compose -p stacks-<env>-test -f docker-compose.test.yml up -d --wait`; then `docker compose -p stacks-<env> up -d --build --wait` | 0 both healthy · 1 refused or failed · 2 environment error |
| `env.mjs down` | `pnpm env:down` | `down -v --remove-orphans` for `stacks-<env>` and `stacks-<env>-test` | 0 (also when either or both were absent) · 1 · 2 |
| `env.mjs down main` | `pnpm env:down main` | Unchanged: `stacks-main` only | as before |
| `env.mjs main` | `pnpm env:main` | Unchanged: no test stack | as `up` |
| `env.mjs status` / `prune` / `prune --check` | | Unchanged code. A test stack is listed, pruned, and reported as its own project | as before |

## Derivation (amended)

| Worktree basename | env | project | test project | app port | db port | test db port |
|---|---|---|---|---|---|---|
| `task-<n>`, 1 ≤ n ≤ 999 | `task-<n>` | `stacks-task-<n>` | `stacks-task-<n>-test` | 3000+n | 15000+n | 25000+n |
| any other name | sanitized | `stacks-<name>` | `stacks-<name>-test` | 3000+k | 15000+k | 25000+k |
| `env-main` (via `main`) | `main` | `stacks-main` | none | 3000 | 5432 | none |

Reserved: `main`, `dev`, and any env ending in `-test`.

## `.env` keys written by `up`

`APP_PORT`, `DB_PORT`, `TEST_DB_PORT`, `STACKS_ENV`,
`TEST_DATABASE_URL=postgres://stacks:stacks@localhost:<TEST_DB_PORT>/stacks`.

## Labels

Unchanged. The test stack's container inherits `org.the-stacks.env`,
`org.the-stacks.worktree`, and `org.the-stacks.commit` from `docker-compose.yml` via `extends`.

## `docker-compose.test.yml`

- Top-level `name: stacks-test` (hand-run and CI default project).
- One service, `db`: `extends` `docker-compose.yml`'s `db`; `env_file: !reset []`;
  `environment` literals `POSTGRES_USER/PASSWORD/DB = stacks`; `volumes: !reset []`;
  `tmpfs: [/var/lib/postgresql/data]`; `ports: !override ["127.0.0.1:${TEST_DB_PORT:-5433}:5432"]`.
- Names no image.
