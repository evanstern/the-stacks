---
id: TASK-0020
title: Per-worktree compose stacks with orphan gates
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:24'
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

Spec: specs/010-worktree-stacks
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
- [ ] #8 Spec phase: Foundational — pure derivation library
- [ ] #9 Spec phase: User Story 1 — isolated stack per worktree (Priority: P1) 🎯 MVP
- [ ] #10 Spec phase: User Story 2 — orphans found, gated, and warned (Priority: P2)
- [ ] #11 Spec phase: User Story 3 — local main on demand (Priority: P3)
- [ ] #12 Spec phase: Polish & re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 010 authored via speckit-specify/plan/tasks. speckit-clarify skipped: doc-0002 (ratified) settles naming, ports, verbs, gates. Plan rulings (a)-(e) in specs/010-worktree-stacks/plan.md. No new dependency.

Operator rulings 2026-09-28: (1) AC #4 ratifies the additive /health 'commit' field amending spec 003's contract (contracts/health.md). (2) The no-leftovers test (AC #5) runs locally as pnpm check:env, not in ci:check; pure-logic tests run in CI.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
