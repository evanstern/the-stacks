# Quickstart — per-worktree stacks

## A worktree stack

```bash
cd .worktrees/task-0022
pnpm env:up                 # stacks-task-0022 on :3022, db on :15022
curl -s localhost:3022/health   # "commit" names this branch's HEAD
pnpm --filter @the-stacks/server db:migrate   # uses TEST_DATABASE_URL from .env
pnpm test                   # integration suites run against this stack
pnpm env:down               # removes containers, network, volume
```

## Before removing a worktree

```bash
(cd .worktrees/task-0022 && pnpm env:down)
git worktree remove .worktrees/task-0022
pnpm env:prune --check      # exit 0 = nothing left behind
```

## Local copy of main

```bash
pnpm env:main               # fetches origin/main, builds in .worktrees/env-main, :3000
pnpm env:down main          # removes the stack and the env-main worktree
```

## Verify the feature (AC #5)

```bash
pnpm check:env              # Docker end-to-end: up → down → zero resources; orphan check
```
