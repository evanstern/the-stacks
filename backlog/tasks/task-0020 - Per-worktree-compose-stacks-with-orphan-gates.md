---
id: TASK-0020
title: Per-worktree compose stacks with orphan gates
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - infra
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/doc-0002 - Runtime-environments-—-proposal.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-0002 Setup/Naming/Orphan-gates sections. Blocked until decision-0006 is ratified. Parallel sweep lanes need isolated databases; today every stack shares one project name and fixed ports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 scripts/env.mjs provides up, down, status, and prune; prune --check exits nonzero on any orphan
- [ ] #2 Compose project name and ports derive from the worktree, so two worktrees and the main stack run at once without collision
- [ ] #3 Every container carries org.the-stacks.env, .worktree, and .commit labels
- [ ] #4 /health reports the running commit
- [ ] #5 A test proves up then down leaves no container, network, or volume
- [ ] #6 Sweep precondition and post-merge cleanup run env prune --check; a Stop hook warns on orphans
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
