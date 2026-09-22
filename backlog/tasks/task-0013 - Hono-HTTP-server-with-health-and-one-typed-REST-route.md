---
id: TASK-0013
title: Hono HTTP server with health and one typed REST route
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 14:42'
labels: []
milestone: m-0
dependencies:
  - TASK-0010
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring up the single Node process that hosts the API, per architecture A1 and A2. Scope is deliberately one real route plus health: this task proves the server seam and the Zod validation discipline that every later route inherits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Hono server starts as the app workspace entrypoint
- [ ] #2 A health endpoint reports process and database status
- [ ] #3 At least one typed REST route validates its input and output with Zod
- [ ] #4 Errors return a consistent structured shape rather than raw stack traces
- [ ] #5 Tests cover the route and the health check
- [ ] #6 Spec phase: Setup (Shared Infrastructure)
- [ ] #7 Spec phase: Foundational (blocking prerequisites)
- [ ] #8 Spec phase: User Story 1 — The operator can tell whether their install is healthy (P1)
- [ ] #9 Spec phase: User Story 2 — A client gets predictable, validated answers (P2)
- [ ] #10 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec: specs/003-hono-server

HELD 2026-09-22: Lane 2 paused before spec authoring. The runbook's per-task loop named the Spec Kit cycle as prose without binding it to the speckit-* skills, and spec 001 was hand-authored as a result. Runbook amendment in progress; spec authoring resumes against the amended loop.

Spec set complete via Spec Kit skills (speckit-specify/plan/tasks): spec.md, plan.md, tasks.md (25 tasks), research.md, data-model.md, quickstart.md, contracts/ (health, echo-route, errors), checklists/. 5 phase ACs seeded. Phases 1-2 dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

phases: 1-2 done (d43c239, T001-T007). Gates verified by orchestrator: typecheck/lint/build green. Error contract verified: internal message is a module constant, caught error goes to console.error only, issues omitted unless validation. Phase 3 next.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
