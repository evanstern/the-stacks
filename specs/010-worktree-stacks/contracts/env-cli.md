# Contract — `scripts/env.mjs` (the `pnpm env:*` commands)

Run from a worktree (or, for `main`/`status`/`prune`, from anywhere in the repo).
Non-interactive. Output is human-readable lines; exit codes are the machine contract.

| Command | pnpm alias | Does | Exit |
|---|---|---|---|
| `env.mjs up` | `pnpm env:up` | Derive env, project, ports for this worktree; refuse from root or for reserved names; probe ports; write `.env`; `docker compose -p stacks-<env> up -d --build` with labels and build arg; wait for healthy | 0 healthy · 1 refused or failed · 2 environment error |
| `env.mjs down [main]` | `pnpm env:down` | `docker compose -p stacks-<env> down -v`. With `main`: the local main stack, then remove `.worktrees/env-main` | 0 (also when nothing was running) · 2 |
| `env.mjs status` | `pnpm env:status` | One line per labeled stack: env, project, worktree, branch, commit, ports, `ORPHAN` marker | 0 · 2 |
| `env.mjs prune` | `pnpm env:prune` | `down -v` every orphan; print each removed | 0 · 2 |
| `env.mjs prune --check` | `pnpm env:prune --check` | Report orphans, change nothing | 0 none · 1 orphans (named) · 2 environment error |
| `env.mjs main` | `pnpm env:main` | Fetch `origin/main`; create or refresh detached worktree `.worktrees/env-main`; `up` it as env `main` on 3000/5432 | as `up` |

## Derivation

| Worktree basename | env | project | app port | db port |
|---|---|---|---|---|
| `task-<n>`, 1 ≤ n ≤ 999 | `task-<n>` | `stacks-task-<n>` | 3000+n | 15000+n |
| any other name | sanitized name | `stacks-<name>` | 3000+k | 15000+k, k = 1000 + sha256(name) mod 8000 |
| `env-main` (via `main`) | `main` | `stacks-main` | 3000 | 5432 |

Reserved: `main`, `dev`. `dev` is vm-104's (TASK-0021).

## Labels (every container)

`org.the-stacks.env`, `org.the-stacks.worktree` (absolute path), `org.the-stacks.commit`.

## Orphan rule

A labeled stack whose env is not `main`/`dev` and whose worktree path is absent from
`git worktree list --porcelain`.
