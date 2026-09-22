---
id: TASK-1
title: Monorepo scaffold and toolchain baseline
status: To Do
assignee: []
created_date: '2026-09-22 01:14'
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
