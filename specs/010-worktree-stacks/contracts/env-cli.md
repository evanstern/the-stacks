# Contract — `scripts/env.mjs` (the `pnpm env:*` commands)

Run from a worktree (or, for `main`/`status`/`prune`, from anywhere in the repo).
Non-interactive. Output is human-readable lines; exit codes are the machine contract.

Amended by spec 020 (test compose stack): `up` and `down` now also manage a per-worktree
throwaway test database stack, `stacks-<env>-test`. `status`/`prune`/`prune --check` needed
no code change — a test stack is just another labeled project to them.

| Command | pnpm alias | Does | Exit |
|---|---|---|---|
| `env.mjs up` | `pnpm env:up` | Derive env, project, test project, ports for this worktree; refuse from root, for reserved names, or for a name ending in `-test`; probe app, db, and test-db ports; write `.env`; `docker compose -p stacks-<env>-test -f docker-compose.test.yml up -d --wait`; migrate and verify both databases (see Migration); then `docker compose -p stacks-<env> up -d --build --wait` with labels and build arg | 0 both healthy · 1 refused or failed · 2 environment error |
| `env.mjs down [main]` | `pnpm env:down` | `down -v --remove-orphans` for `stacks-<env>-test` (via `docker-compose.test.yml`), then `stacks-<env>`; removes the `stacks-<env>-migrate` image. With `main`: the local main stack only, then remove `.worktrees/env-main` | 0 (also when either or both were absent) · 2 |
| `env.mjs status` | `pnpm env:status` | One line per labeled stack: env, project, worktree, branch, commit, ports, `ORPHAN` marker (a test stack lists as its own project) | 0 · 2 |
| `env.mjs prune` | `pnpm env:prune` | `down -v` every orphan and remove its `-migrate` image; print each removed | 0 · 2 |
| `env.mjs prune --check` | `pnpm env:prune --check` | Report orphans, change nothing | 0 none · 1 orphans (named) · 2 environment error |
| `env.mjs main` | `pnpm env:main` | Fetch `origin/main`; create or refresh detached worktree `.worktrees/env-main`; `up` it as env `main` on 3000/5432, no test stack; migrates and verifies the app database only | as `up` |

## Migration (spec 095)

`up` and `main` migrate before the app service starts. No hand `db:migrate` step remains.

1. Build the Dockerfile `build` stage as `stacks-<env>-migrate` (a layer-cache hit after the first build).
2. Test database (`up` only): after the test stack is healthy, run `scripts/migrate.ts` in that image on the
   `stacks-<env>-test_default` network with the fixed throwaway credentials.
3. App database: `docker compose -p stacks-<env> up -d --wait db`, then run `scripts/migrate.ts` in the
   image on the `stacks-<env>_default` network with `--env-file .env` and `TEST_DATABASE_URL=` cleared. Docker
   reads `.env`; the host never parses a password.
4. Verify: count rows in `drizzle.__drizzle_migrations` through the database container's own env. A count
   below the entry count of `apps/server/drizzle/meta/_journal.json` exits 1 and names the database (app or test).
5. `down` and `prune` remove the `stacks-<env>-migrate` image.

Host `db:migrate` and `auth:create-operator` print `target: host:port/database` (never the user or
password) before they act. They prefer `TEST_DATABASE_URL`, so on the host they target the test database.
To provision an operator in the app database, run inside the stack:

```bash
docker compose -p stacks-<env> exec app node dist/cli/create-operator.js
```

## Derivation

| Worktree basename | env | project | test project | app port | db port | test db port |
|---|---|---|---|---|---|---|
| `task-<n>`, 1 ≤ n ≤ 999 | `task-<n>` | `stacks-task-<n>` | `stacks-task-<n>-test` | 3000+n | 15000+n | 25000+n |
| any other name | sanitized name | `stacks-<name>` | `stacks-<name>-test` | 3000+k | 15000+k, k = 1000 + sha256(name) mod 8000 | 25000+k |
| `env-main` (via `main`) | `main` | `stacks-main` | none | 3000 | 5432 | none |

Reserved: `main`, `dev` (vm-104's, TASK-0021), and any env ending in `-test` — it would
collide with its own worktree's test project (spec 020 R9).

## `.env` keys written by `up`

Amended by spec 022 (root `.env` inheritance): per key, the first layer that has it wins.

1. Derived: `APP_PORT`, `DB_PORT`, `STACKS_ENV`, and (all worktrees but `env:main`)
   `TEST_DB_PORT` and `TEST_DATABASE_URL=postgres://stacks:stacks@localhost:<TEST_DB_PORT>/stacks`
   — the test stack's fixed, throwaway credentials, never the app database's (spec 020 R5).
2. Shared: the root checkout's `.env` (`<dirname of git-common-dir>/.env`), minus the five
   derived keys above, always. Missing file = empty layer. `env:main`'s `.worktrees/env-main`
   inherits this layer too.
3. The worktree's existing `.env`.
4. `.env.example`'s default.

Layout and comments come from `.env.example`. Keys absent from it are appended in order:
derived, shared, existing. Values are copied verbatim; no per-worktree override of a shared
key exists (root always wins). `up` and `main` print `inherited from <root>/.env: KEY, …`
listing shared key names (never values) when the root `.env` has any non-derived key.

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
