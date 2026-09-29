---
id: TASK-0020
title: Per-worktree compose stacks with orphan gates
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 02:43'
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



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
