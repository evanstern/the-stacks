---
id: TASK-0011
title: 'Docker Compose stack: app and Postgres 17 with pgvector'
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 14:28'
labels: []
milestone: m-0
dependencies:
  - TASK-0010
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the two-container compose stack from architecture A1: one Node app container and one Postgres 17 container with pgvector. Self-hosting is the distribution model, so 'docker compose up' working from a clean clone is a product requirement, not a convenience.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker compose up brings up app and db from a clean checkout
- [ ] #2 Postgres 17 runs with the pgvector extension available
- [ ] #3 Database data persists across container restarts via a named volume
- [ ] #4 Configuration is supplied by environment variables with a committed .env.example
- [ ] #5 The app container reaches the database and reports healthy
- [ ] #6 Spec phase: Setup (Shared Infrastructure)
- [ ] #7 Spec phase: Foundational (blocking prerequisites)
- [ ] #8 Spec phase: User Story 1 — A stranger can run this project (P1)
- [ ] #9 Spec phase: User Story 2 — An operator's data survives restarts and upgrades (P1)
- [ ] #10 Spec phase: User Story 3 — The database is ready for what the project will need (P2)
<!-- AC:END -->











## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec: specs/002-compose-stack

HELD 2026-09-22: Lane 2 paused before spec authoring. The runbook's per-task loop named the Spec Kit cycle as prose without binding it to the speckit-* skills, and spec 001 was hand-authored as a result. Runbook amendment in progress; spec authoring resumes against the amended loop.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
