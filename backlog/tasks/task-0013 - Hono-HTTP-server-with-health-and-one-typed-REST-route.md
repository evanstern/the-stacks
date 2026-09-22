---
id: TASK-0013
title: Hono HTTP server with health and one typed REST route
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
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
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
