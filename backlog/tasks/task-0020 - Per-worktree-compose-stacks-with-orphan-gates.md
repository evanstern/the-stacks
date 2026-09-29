---
id: TASK-0020
title: Per-worktree compose stacks with orphan gates
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 05:00'
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
- [x] #8 Spec phase: Foundational — pure derivation library
- [x] #9 Spec phase: User Story 1 — isolated stack per worktree (Priority: P1) 🎯 MVP
- [ ] #10 Spec phase: User Story 2 — orphans found, gated, and warned (Priority: P2)
- [ ] #11 Spec phase: User Story 3 — local main on demand (Priority: P3)
- [ ] #12 Spec phase: Polish & re-ground
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 010 authored via speckit-specify/plan/tasks. speckit-clarify skipped: doc-0002 (ratified) settles naming, ports, verbs, gates. Plan rulings (a)-(e) in specs/010-worktree-stacks/plan.md. No new dependency.

Operator rulings 2026-09-28: (1) AC #4 ratifies the additive /health 'commit' field amending spec 003's contract (contracts/health.md). (2) The no-leftovers test (AC #5) runs locally as pnpm check:env, not in ci:check; pure-logic tests run in CI.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 1 (T001-T003) done in 3b7d78f: scripts/env-lib.mjs + 12 tests, check:scripts in ci:check. Orchestrator verified 12/12 pass. ~133k subagent tokens.

Phase 2 (T004-T010) implemented in this worktree, commit 1f0dd03 (+ down() fix, see PR). pnpm ci:check: PASS. T010 manual proof: two worktrees (task-0020 + scratch env-t010-manual, both at commit 1f0dd03) up simultaneously on 3020/15020 and 4150/16150 with no collision; both /health ok with matching commit; down in one left the other healthy; down in both left zero docker resources for either project name. Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=cc/claude-sonnet-5[1m]. Phase 3 (status/prune/hook) and Phase 4 (env:main) not started.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 2 (T004-T010) done in 1f0dd03 + c6ba392 (down() destructuring bug found by the T010 manual proof and fixed). T010 evidence: two stacks up at once on 3020/15020 and 4150/16150, both /health ok with commit; teardown left zero labeled resources (orchestrator re-checked: no org.the-stacks.env containers). ~217k subagent tokens. Full evidence note is on main's copy of this card.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 3 (T011-T016) done in 136622b: env status/prune[--check], env.test.mjs (pnpm check:env: up->health commit->down->zero resources; prune finds and removes orphan; both pass for real), warn-only Stop hook (always exits 0), CLAUDE.md Runtime stacks section after pdlc:grounding END, runbook gate lines. Orchestrator verified: settings.json diff adds only hooks.Stop; PreToolUse root-guard entries unchanged, asserted by env-orphan-hook.test.mjs (4/4 pass). ~164k subagent tokens.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 4-5 (3a8cdcc, b5469e1) and post-#22 merge (77683a0, 15dbde0, d5853b0). Orchestrator verified: config.ts import-free (0 imports) with commit field; ci:check includes check:scripts + check:host-scripts; freshness OK 29; no org.the-stacks.env containers; no stray worktrees. T021 (praxisflux upstream request for env prune --check in the sweep skill) is outbound to another project: left unticked and surfaced to the operator, not filed silently. AC #6 is satisfied in-repo by the Stop hook + CLAUDE.md Runtime stacks section + runbook gate lines.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Merge with main after #23 (77a2547, pins 8204d23, evidence ff21389): conflicts only on verified_against lines + feature.json + CAPSULES; test counts recomputed from merged tree. Also carries close-task-0025 (TASK-0025 Done sync).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
