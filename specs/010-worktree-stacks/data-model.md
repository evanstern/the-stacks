# Data model — 010 per-worktree compose stacks

No database tables. The model is the in-memory shape `env-lib.mjs` works with, derived from
`git` and `docker` output on every call. Nothing is persisted outside Docker's own state and
each worktree's `.env`.

## StackIdentity (derived from a worktree)

| Field | Source | Example |
|---|---|---|
| `env` | sanitized worktree basename, or `main` | `task-0020` |
| `project` | `stacks-${env}` | `stacks-task-0020` |
| `worktree` | absolute toplevel path | `/…/the-stacks/.worktrees/task-0020` |
| `commit` | `git rev-parse HEAD` (+ `-dirty`) | `b6b45bb…` |
| `appPort` | R3 | `3020` |
| `dbPort` | R3 | `15020` |

## RunningStack (derived from `docker ps -a` labels)

| Field | Source |
|---|---|
| `project` | `com.docker.compose.project` label |
| `env` | `org.the-stacks.env` |
| `worktree` | `org.the-stacks.worktree` |
| `commit` | `org.the-stacks.commit` |
| `state` | container states, collapsed (running / exited / mixed) |
| `orphan` | `env ∉ {main, dev}` and `worktree ∉ git worktree list` |

## Env file merge

`.env` = keys of `.env.example`, overlaid by existing `.env` keys, overlaid by derived keys
(`APP_PORT`, `DB_PORT`, `STACKS_ENV`, `TEST_DATABASE_URL`). Derived keys always win, because
a stale port in `.env` would point tests at another stack's database.
