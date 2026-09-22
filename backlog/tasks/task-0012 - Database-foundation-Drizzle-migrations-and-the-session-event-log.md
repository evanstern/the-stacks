---
id: TASK-0012
title: 'Database foundation: Drizzle, migrations, and the session event log'
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 17:37'
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
- [x] #7 Spec phase: Setup (Shared Infrastructure)
- [x] #8 Spec phase: Foundational (Blocking Prerequisites)
- [x] #9 Spec phase: User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP
- [ ] #10 Spec phase: User Story 3 — Append safely while several writers act at once (Priority: P2)
- [ ] #11 Spec phase: User Story 2 — Stand up the schema on a fresh database (Priority: P2)
- [ ] #12 Spec phase: User Story 4 — Carry who may see an event, and which shape it has (Priority: P3)
- [ ] #13 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 1-2 (T001-T010) dispatched to sonnet-implementer and verified by the
orchestrator against a FRESH database (volume removed, recreated), not accepted
on report. Served model read from the transcript: 184 occurrences of
claude-sonnet-5, no other model present.

Verified independently:
- Migration applies to an empty database; second run adds no migration row
  (exactly 1 row in drizzle.__drizzle_migrations after two runs) -- SC-006.
- Table shape matches data-model.md exactly: 8 columns, composite PK
  (session_id, seq), both check constraints, the append-only trigger, and NO
  redundant index.
- Append-only enforced AT THE DATABASE: INSERT succeeds; UPDATE and DELETE are
  both rejected by the trigger -- FR-004 holds for every client, not just this
  application.
- Check constraints reject seq=0 and payload_version=0; the PK rejects a
  duplicate (session_id, seq) -- the backstop the advisory-lock design relies on.
- Defaults apply: visibility='public' and a non-null ts without either supplied
  (FR-013).
- Gates green: typecheck, lint, 10/10 tests, build.

Orchestrator fix found by verification (9a36fdb): db:migrate failed with
'DATABASE_URL environment variable is required' unless the caller had already
exported it, so the ONE documented command of FR-010 would have errored on a
self-hoster's first run. Fixed with Node 22's built-in --env-file-if-exists
(stdlib, no new dependency; the -if-exists form because containers and CI supply
real env vars and have no .env file).

Implementer improved on the dispatch brief: extracted a shared createPool()
helper so the T016 pool-error handler cannot be omitted by a second connection
path, rather than merely not omitting it.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 3 (US1, T011-T017) dispatched to sonnet-implementer and verified by the
orchestrator. Served model read from the transcript: 68 occurrences of
claude-sonnet-5, no other model.

Verified independently against the real database:
- 14/14 tests pass with the integration suite ACTUALLY RUNNING (not skipped).
- Loud skip proven: with an unreachable database the suite prints an explicit
  warning naming what was not proven and reports '4 skipped' -- structurally
  distinguishable from a green run (research D2).
- Cursor semantics correct: strictly-after, ascending, empty-not-error both AT
  and BEYOND the newest position, limit capping while preserving order.
- Beyond what the tests cover, the orchestrator probed the seam directly:
  caller-supplied seq and ts are both REJECTED at runtime; visibility defaults
  to 'public'; an event with an unrecognized type and payloadVersion=9999 is
  RETURNED rather than dropped (FR-012, constitution IV).
- Gates green: typecheck, lint, build.

RACE EVIDENCE (pre-proves T020, and justifies T021 as load-bearing):
The orchestrator ran 50 concurrent appends against the current lock-free
MAX(seq)+1 implementation, three times:
  run 1: 28 stored, 22 lost
  run 2: 29 stored, 21 lost
  run 3: 27 stored, 23 lost
Roughly 44% of appends are LOST under concurrency -- the primary key correctly
rejects duplicate positions, so nothing is corrupted and what survives is
gapless, but events vanish. This confirms the (session_id, seq) PK backstop
works AND that the advisory lock in T021 is required, not belt-and-braces.
T020's 'prove the test fails without the fix' is therefore already evidenced.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
