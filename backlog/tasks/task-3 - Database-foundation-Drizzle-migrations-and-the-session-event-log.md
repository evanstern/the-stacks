---
id: TASK-3
title: 'Database foundation: Drizzle, migrations, and the session event log'
status: To Do
assignee: []
created_date: '2026-09-22 01:14'
labels: []
milestone: m-0
dependencies:
  - TASK-2
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish the persistence layer and the single most load-bearing table in the system: the append-only session event log from architecture A4. Events are versioned from day one because event-log schema churn is a standing risk in milestones.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Drizzle ORM is wired with a committed, versioned migration workflow
- [ ] #2 Migrations run automatically or by a documented command on a fresh database
- [ ] #3 An events table exists keyed by (session_id, seq) with actor, type, payload, visibility, and timestamp columns
- [ ] #4 Event payloads carry a schema version field
- [ ] #5 Appending events is race-safe under concurrent writers to the same session
- [ ] #6 Tests cover append and ordered read-back from a seq cursor
<!-- AC:END -->
