---
id: TASK-0012
title: 'Database foundation: Drizzle, migrations, and the session event log'
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 17:14'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Spec 004 (specs/004-event-log), 36 tasks across 7 phases.

Race-safety mechanism (runbook's flagged judgment call) settled in research D1:
transaction-scoped per-session Postgres advisory lock, computing MAX(seq)+1 inside
the transaction, with the (session_id, seq) primary key as backstop. Gaplessness --
not mere uniqueness -- drives the choice: A4's reconnect-from-cursor makes a
permanent gap indistinguishable from an unwritten event, which disqualifies
sequences and identity columns (non-transactional, gappy by construction).

Research D2: race-safety is proven against a real Postgres, never a fake, with a
LOUD skip when no database is reachable. Rationale is the T016 finding -- every
existing test injected fakes, so no test touched the real connection path and a
process-killing crash reached main.

Dispatch plan: phase-scoped to sonnet-implementer. Phases 1+2 grouped (the
migration is generated FROM the schema; splitting them means a second dispatch to
fix the first one's output). Phases 3-7 follow.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
