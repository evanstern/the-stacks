---
id: TASK-0017
title: 'CI pipeline: lint, typecheck, test, build, and boundary check'
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-27 15:29'
labels: []
milestone: m-0
dependencies:
  - TASK-0010
documentation:
  - docs/design/architecture.md
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Put the gate in place that every later milestone extends. M1 adds retrieval eval fixtures and M3 adds the system-module conformance suite, so CI must be structured to grow. The boundary check enforces the three data planes from architecture A3 and keeps the plane discipline from eroding by accident.

Spec: specs/009-ci-pipeline
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI runs on pull requests and on the default branch
- [ ] #2 Lint, typecheck, test, and build all run and must pass
- [ ] #3 A boundary check fails the build when a forbidden cross-plane or cross-package import is introduced
- [ ] #4 The pipeline is structured so later milestones can add suites without restructuring it
- [ ] #5 A green run is reproducible locally with a documented command
- [x] #6 Spec phase: Foundational — the one command
- [ ] #7 Spec phase: User Story 4 — test files typechecked (Priority: P2, foundational for CI green)
- [ ] #8 Spec phase: User Story 2 — integration tests cannot skip in CI (Priority: P1)
- [ ] #9 Spec phase: User Story 3 — boundary check (Priority: P1)
- [ ] #10 Spec phase: User Story 1 — the workflow (Priority: P1) 🎯 MVP gate
- [ ] #11 Spec phase: User Story 5 — document and extend (Priority: P2)
- [ ] #12 Spec phase: Polish & re-ground
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
