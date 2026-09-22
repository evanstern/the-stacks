---
id: TASK-0012
title: 'Database foundation: Drizzle, migrations, and the session event log'
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 17:12'
labels: []
milestone: m-0
dependencies:
  - TASK-0011
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish the persistence layer and the single most load-bearing table in the system: the append-only session event log from architecture A4. Events are versioned from day one because event-log schema churn is a standing risk in milestones.md.

Spec: specs/004-event-log
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Drizzle ORM is wired with a committed, versioned migration workflow
- [ ] #2 Migrations run automatically or by a documented command on a fresh database
- [ ] #3 An events table exists keyed by (session_id, seq) with actor, type, payload, visibility, and timestamp columns
- [ ] #4 Event payloads carry a schema version field
- [ ] #5 Appending events is race-safe under concurrent writers to the same session
- [ ] #6 Tests cover append and ordered read-back from a seq cursor
- [ ] #7 Spec phase: Setup (Shared Infrastructure)
- [ ] #8 Spec phase: Foundational (Blocking Prerequisites)
- [ ] #9 Spec phase: User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP
- [ ] #10 Spec phase: User Story 3 — Append safely while several writers act at once (Priority: P2)
- [ ] #11 Spec phase: User Story 2 — Stand up the schema on a fresh database (Priority: P2)
- [ ] #12 Spec phase: User Story 4 — Carry who may see an event, and which shape it has (Priority: P3)
- [ ] #13 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
