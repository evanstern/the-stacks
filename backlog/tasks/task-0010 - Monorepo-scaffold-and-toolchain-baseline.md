---
id: TASK-0010
title: Monorepo scaffold and toolchain baseline
status: In Progress
assignee: []
created_date: '2026-09-22 06:43'
updated_date: '2026-09-22 14:09'
labels: []
milestone: m-0
dependencies: []
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the pnpm + Turborepo workspace that every other M0 task builds inside. This is the first code in a greenfield repo, so it fixes the conventions: package layout, TypeScript project references, shared config, and the lint/format baseline. Architecture A1 binds the toolchain choices.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm workspaces + Turborepo configured at the repo root with a working task pipeline
- [ ] #2 Workspace packages exist for the server app, the web client, and at least one shared package
- [ ] #3 TypeScript strict mode is on and typecheck passes across every workspace package
- [ ] #4 Lint and format run from the root and pass on a clean tree
- [ ] #5 Node 22 is pinned for the project
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec: specs/001-monorepo-scaffold/ (sweep: docs/design/m0-skeleton-sweep-runbook.md, Lane 1)

Spec set complete: spec.md + plan.md + tasks.md on task-0010-monorepo-scaffold. 4 phases; dispatching phase-scoped at tier=sonnet.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

phases: 1-3 done (e30f1c0, 4e1c175), 4 dispatched. Verified: clean tsc -b rebuild emits shared/dist first (real project references).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
