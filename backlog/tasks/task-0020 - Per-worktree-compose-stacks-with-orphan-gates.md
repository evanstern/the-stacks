---
id: TASK-0020
title: Per-worktree compose stacks with orphan gates
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:40'
labels:
  - infra
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/doc-0002 - Runtime-environments-—-rulings.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-0002 Environments, Setup, Naming, and Orphan-gates sections (decision-0006, ratified 2026-09-28). Parallel sweep lanes need isolated databases; today every stack shares one project name and fixed ports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scripts/env.mjs provides up, down, status, and prune; prune --check exits nonzero on any orphan
- [ ] #2 Compose project name and ports derive from the worktree, so two worktrees and the main stack run at once without collision
- [ ] #3 Every container carries org.the-stacks.env, .worktree, and .commit labels
- [ ] #4 /health reports the running commit
- [ ] #5 A test proves up then down leaves no container, network, or volume
- [ ] #6 Sweep precondition and post-merge cleanup run env prune --check; a Stop hook warns on orphans
- [ ] #7 One command (pnpm env:main) starts a local main stack ad hoc from a fresh origin/main checkout, and env down main stops it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Phase 2 (T004-T010) implemented in .worktrees/task-0020, commit 1f0dd03 (+ down() fix). pnpm ci:check: PASS (lint, typecheck, build, test, check:boundaries, check:hooks, check:scripts all green).

T010 manual proof — two worktrees up at once, no collision:
$ cd .worktrees/task-0020 && node scripts/env.mjs up
  -> stacks-task-0020: up — http://localhost:3020 (db :15020), commit 1f0dd033dddc39fc397adc5c737ff68480214e69
$ cd .worktrees/env-t010-manual (scratch worktree, detached at same commit) && node scripts/env.mjs up
  -> stacks-env-t010-manual: up — http://localhost:4150 (db :16150), commit 1f0dd033dddc39fc397adc5c737ff68480214e69
$ curl -s localhost:3020/health -> {"status":"ok",...,"commit":"1f0dd033..."}
$ curl -s localhost:4150/health -> {"status":"ok",...,"commit":"1f0dd033..."}
Both healthy simultaneously on distinct derived ports; docker ps confirmed 4 running containers (2 per stack), no port/name collision.

T010 teardown proof: `node scripts/env.mjs down` in env-t010-manual removed its containers/network/volume; task-0020's stack stayed healthy (curl :3020/health still ok) — confirmed via `docker ps -a --filter label=com.docker.compose.project=stacks-env-t010-manual` (containers/networks/volumes all empty). Then `down` in task-0020 too; same empty-filter check confirmed zero stacks-task-0020 resources remained. Scratch worktree removed (`git worktree remove --force .worktrees/env-t010-manual`, no unique commits — detached at the shared commit).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-4-5-20250929

Deviation found+fixed during manual proof: env.mjs down() initially destructured `project` from the wrong return shape (resolveIdentity returns {toplevel, identity}, not {project}), so `docker compose -p undefined down` no-opped harmlessly. Fixed before commit; re-verified full teardown as above.

Phase 2 only (T004-T010) per dispatch scope. Phase 3 (status/prune/orphan hook) and Phase 4 (env:main) not started.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
