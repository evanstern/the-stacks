---
id: TASK-0012
title: 'Database foundation: Drizzle, migrations, and the session event log'
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 18:26'
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
- [x] #1 Drizzle ORM is wired with a committed, versioned migration workflow
- [x] #2 Migrations run automatically or by a documented command on a fresh database
- [x] #3 An events table exists keyed by (session_id, seq) with actor, type, payload, visibility, and timestamp columns
- [x] #4 Event payloads carry a schema version field
- [x] #5 Appending events is race-safe under concurrent writers to the same session
- [x] #6 Tests cover append and ordered read-back from a seq cursor
- [x] #7 Spec phase: Setup (Shared Infrastructure)
- [x] #8 Spec phase: Foundational (Blocking Prerequisites)
- [x] #9 Spec phase: User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP
- [x] #10 Spec phase: User Story 3 — Append safely while several writers act at once (Priority: P2)
- [x] #11 Spec phase: User Story 2 — Stand up the schema on a fresh database (Priority: P2)
- [x] #12 Spec phase: User Story 4 — Carry who may see an event, and which shape it has (Priority: P3)
- [x] #13 Spec phase: Polish & Cross-Cutting Concerns
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

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 4 (US3, T018-T022) dispatched to sonnet-implementer and verified by the
orchestrator. Served model from transcript: 48 occurrences of claude-sonnet-5.

THE MEASUREMENT THAT MATTERS -- orchestrator's own race probe, same script that
measured the pre-lock baseline:
  BEFORE (no lock): 28/50, 29/50, 27/50 stored -- 21-23 events LOST per run
  AFTER  (locked):  50/50, 50/50, 50/50 stored -- 0 lost, positions 1..50,
                    gapless and duplicate-free, three runs in a row
AC#5 (race-safe under concurrent writers) is therefore proven by independent
measurement, not by the implementer's own test alone.

Also verified independently:
- FR-003 cross-session independence: 25 concurrent appends to each of two
  sessions -> both numbered 1..25 independently, 50 appends in 107ms. The lock
  is per-session, not global (a global lock would pass T018 and break the
  feature).
- Lock form is pg_advisory_xact_lock (transaction-scoped) with the two-argument
  namespaced form, keyed by hashtext(sessionId) under a fixed EVLG namespace.
- ZERO advisory locks held in pg_locks after 200+ concurrent appends: the xact
  form releases at commit/rollback, so no pooled connection is ever returned
  still holding a lock (the deadlock the session-scoped form would cause).
- T020 re-proven by the orchestrator, not accepted on report: disabling only the
  lock line makes T018 AND T019 fail with 'duplicate key value violates unique
  constraint events_session_id_seq_pk'. Restored byte-identical (empty diff),
  16/16 pass again.
- Gates green: 16/16 tests, typecheck, lint, build.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 5-7 (T023-T036) dispatched to sonnet-implementer and verified. Served
model from transcript: 99 occurrences of claude-sonnet-5. All 36 tasks in
tasks.md are now ticked; 22/22 tests pass with the integration suite genuinely
running (not skipped).

ORCHESTRATOR FINDING, fixed in 61049ce -- DATABASE_URL could not serve both
callers, and the failure was silent:
  container URL (@db:5432)   -> compose works, 10 integration tests SKIP
  host URL (@localhost:5433) -> tests run, app container reports degraded
The skip is the dangerous half: a green run proving nothing about append,
ordering, or race-safety -- the blind spot research D2 and the T016 finding
exist to prevent. Tests now read TEST_DATABASE_URL first, DATABASE_URL second.
The committed .env.example keeps DATABASE_URL=@db:5432 so a self-hoster's
docker compose up is unchanged, and documents TEST_DATABASE_URL. Both declared
in turbo.json globalEnv for cache correctness. Quickstart step 3 updated, since
following it verbatim produced a green run with 10 tests skipped.

T036 (docker compose up, constitution IX) PASSES: full stack built and started
from this worktree, both containers healthy, /health returns
{status:ok, database:{reachable:true}}. The implementer's 'degraded' reading was
an artifact of the local .env being repointed for host tests, not a defect.

Quickstart step 4 verified by the orchestrator: every 50-append session shows
events = highest = distinct_positions = 50, gapless and unique.

Known gap, NOT fixed here (belongs to TASK-0017, out of sweep scope):
apps/server/tsconfig.json scopes include to ['src'], so test/ is never
typechecked. The implementer correctly declined to add a @ts-expect-error test
for missing mandatory fields, since it would sit inert and manufacture
confidence -- the exact anti-pattern tasks.md warns against for T020.

spec-bridge sync: Setup (Shared Infrastructure): 4/4 · Foundational (Blocking Prerequisites): 6/6 · User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP: 7/7 · User Story 3 — Append safely while several writers act at once (Priority: P2): 5/5 · User Story 2 — Stand up the schema on a fresh database (Priority: P2): 3/3 · User Story 4 — Carry who may see an event, and which shape it has (Priority: P3): 4/4 · Polish & Cross-Cutting Concerns: 7/7 — status In Progress → Done

Merge resolved (2026-09-22): the operator reviewed and merged PR #8 at cc830c4.
Verified via gh api (.merged=true). Root fast-forwarded; gates re-run green on
main (typecheck, lint, build). Board moved In Progress -> Done by spec-bridge
sync, computed from the spec artifacts rather than hand-set.

The earlier merge block is therefore closed: it was the auto-mode classifier
refusing a session's merge of its own unreviewed work, which is the guardrail
behaving correctly. A human reviewed and merged it.

Worktree .worktrees/task-0012 removed; branch task-0012-event-log deleted after
confirming every commit is contained in main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup (Shared Infrastructure): 4/4 · Foundational (Blocking Prerequisites): 6/6 · User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP: 7/7 · User Story 3 — Append safely while several writers act at once (Priority: P2): 5/5 · User Story 2 — Stand up the schema on a fresh database (Priority: P2): 3/3 · User Story 4 — Carry who may see an event, and which shape it has (Priority: P3): 4/4 · Polish & Cross-Cutting Concerns: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
