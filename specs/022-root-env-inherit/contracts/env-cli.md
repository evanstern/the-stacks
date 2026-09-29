# Contract — `scripts/env.mjs`, amended by 022

This amends `specs/010-worktree-stacks/contracts/env-cli.md`. Rows not listed are unchanged.
T006 folds this section into the 010 contract.

| Command | pnpm alias | Change |
|---|---|---|
| `env.mjs up` | `pnpm env:up` | When writing `.env`, layer in the root checkout's `.env` (below). Print `inherited from <root>/.env: <KEY, …>` when it has any non-derived key. Exit codes unchanged |
| `env.mjs main` | `pnpm env:main` | Same inheritance for `.worktrees/env-main`. Identity, ports, and stack shape unchanged |
| `env.mjs up` from root | | Unchanged: refused. Root's `.env` is never written |
| `status` / `prune` / `prune --check` / `down` | | Unchanged |

## `.env` written by `up` (amended)

Per key, the first layer holding it wins:

1. Derived: `APP_PORT`, `DB_PORT`, `STACKS_ENV`, and (not `env:main`) `TEST_DB_PORT`,
   `TEST_DATABASE_URL`.
2. Shared: the root checkout's `.env` (`<dirname of git-common-dir>/.env`), minus the five
   derived keys above, always. Missing file = empty layer.
3. The worktree's existing `.env`.
4. `.env.example`'s default.

Layout and comments come from `.env.example`. Keys absent from it are appended: derived,
then shared, then existing. Values are copied verbatim. Multi-line values are unsupported.

## Output

`env:up` and `env:main` may print shared key names. No command prints a shared value.
