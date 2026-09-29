# Quickstart — 022 root .env inheritance

## Set shared keys once

1. Put secrets and shared config in the root checkout's `.env` (the main clone, not a
   worktree). Example keys: `NINEROUTER_API_KEY`, `AI_PROVIDERS`, `AI_PURPOSES`.
2. Leave port and identity keys out. `env:up` ignores them anyway.

## Pick them up in a worktree

```sh
pnpm env:up        # prints: inherited from <root>/.env: AI_PROVIDERS, AI_PURPOSES, …
```

Run `pnpm env:up` again after changing root's `.env`. Root's value replaces the worktree's.
A running app container reads `.env` only at start, so the rerun is required.

## Root sets `POSTGRES_PASSWORD` after a worktree stack exists

Postgres keeps the password its volume was created with. Recreate the volume:

```sh
pnpm env:down && pnpm env:up
```

## Check without printing a secret

```sh
cut -d= -f1 .env   # key names only
```
