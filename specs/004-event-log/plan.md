# Implementation Plan: Database foundation — Drizzle, migrations, and the session event log

**Branch**: `task-0012-event-log` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-event-log/spec.md`

## Summary

Wire Drizzle to the existing Postgres connection, add a committed versioned migration
workflow, and create the `events` table from architecture A4 — `(session_id, seq)` keyed,
carrying actor, type, payload, payload version, visibility, and timestamp — with an append
path that is gapless under concurrent writers and a cursor read that returns a session's
stream in order.

The technical approach follows [research.md](./research.md): appends serialize on a
**transaction-scoped Postgres advisory lock keyed per session**, computing
`seq = MAX(seq) + 1` inside that transaction, with the `(session_id, seq)` primary key as
the backstop (D1). Gaplessness — not merely uniqueness — is the requirement that drives
this choice and disqualifies sequences and identity columns, which are non-transactional
and gappy by design. Race-safety is proven against a **real database**, never a fake (D2),
because a concurrency guarantee is exactly what a test double cannot exhibit — the lesson
the T016 finding already charged this project once.

## Technical Context

**Language/Version**: TypeScript 5.x on Node 22 (Architecture Constraints table)

**Primary Dependencies**: Drizzle ORM (already a server dependency) + `drizzle-kit` for
migration generation (new dev dependency, and the ORM row of the constraints table names
"Drizzle, with versioned migrations" — the generator is that row, not an addition to it);
`pg` (already present)

**Storage**: Postgres 17 with pgvector, already running via compose (TASK-0011)

**Testing**: Vitest (repository baseline), with integration tests against a real Postgres

**Target Platform**: Linux server container, self-hosted (constitution IX)

**Project Type**: Web service — one Node process (Architecture A2)

**Performance Goals**: Appends to distinct sessions proceed without mutual blocking; the
advisory lock serializes only within one session. No throughput target is set for M0 — the
walking skeleton's bar is correctness at the 50-concurrent-writer level of SC-003.

**Constraints**: Gapless, duplicate-free, append-only ordering per session — the guarantee
every later replay and reconnect path depends on.

**Scale/Scope**: One table, one migration, one data-access module, plus tests. No API
surface and no WebSocket work: those are TASK-0014 and TASK-0015.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — the append and cursor-read seam
      ([contracts/event-log.md](./contracts/event-log.md)) is the only way events enter or
      leave the log, and it is identity-agnostic: `actor` is an opaque identifier, so the
      AI DM appends through the same call a human participant's action travels (A4, CR-001).
      No human-only path exists because no path is aware of humans.
- [x] **II. Content contract** — no codex entity is created by this feature. The event log
      is session-plane infrastructure; codex entities and their identity/portrayal/hooks
      contracts arrive in M2. Not applicable, not waived.
- [x] **III. Data planes** — every column added here belongs to the **session plane**. No
      library or codex table is read or written, and no import crosses a plane boundary
      (the boundary check has nothing to catch because nothing crosses).
- [x] **IV. Event sourcing** — this feature *is* principle IV made concrete: append-only
      (enforced by trigger as well as by code path), ordered by `(session_id, seq)`,
      `payload_version` on every event, `visibility` on every event with a non-null default,
      and reads that return unrecognized types and versions rather than dropping them
      (FR-012). Server authority holds because `seq` and `ts` are assigned by the append
      path and cannot be supplied by a caller.
- [x] **V. Citations** — no library-derived claim is made or stored. Retrieval arrives in
      M1. Not applicable.
- [x] **VI. System-agnostic** — `type` and `payload` are opaque to the log (research D4).
      No 5e concept appears in the schema; a Fate module writes the same table unchanged.
      Payload validation deliberately waits for the system-module interface in M3 rather
      than baking one system's shape into a table that can never be rewritten in place.
- [x] **VII. Structured first** — no generated artifact and no asset in this feature. The
      payload is stored as structured `jsonb` rather than text, which is the closest this
      principle comes to applying. Not applicable otherwise.
- [x] **VIII. Operator-owned content** — ships no rulebook content, seeds no fixtures
      containing book text, and reproduces nothing. Test data is synthetic. NON-NEGOTIABLE
      and clean.
- [x] **IX. Self-hostable** — runs on the compose stack that already exists. Migrations
      apply with one documented command (FR-010). **No new container, no new service, no
      managed dependency.** `drizzle-kit` is a build-time dev dependency, not a runtime
      service.

**Stack conformance** — TypeScript, one Node process, Postgres, Drizzle. `drizzle-kit` is
the generator for the constraints table's own "Drizzle, with versioned migrations" row, so
it introduces no departure. Nothing here touches Hono, React, or PixiJS.

**Post-Phase-1 re-check**: re-evaluated after data-model, contracts, and quickstart were
written. No gate changed. The design added one thing worth naming against principle IV —
the database-level trigger rejecting `UPDATE`/`DELETE` — which strengthens append-only
from a code convention to a database property, covering clients that are not this
application.

## Project Structure

### Documentation (this feature)

```text
specs/004-event-log/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: D1 sequencing, D2 real-database testing, D3 migrations, D4 opaque payloads
├── data-model.md        # Phase 1: the events table, keys, constraints, append-only enforcement
├── quickstart.md        # Phase 1: runnable validation
├── contracts/
│   └── event-log.md     # Phase 1: the append + cursor-read seam TASK-0015 consumes
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/server/
├── drizzle.config.ts          # NEW — drizzle-kit configuration
├── drizzle/                   # NEW — generated, committed migration SQL + journal
├── src/
│   ├── db.ts                  # EXISTING — health probe pool; gains the Drizzle client
│   ├── config.ts              # EXISTING — DATABASE_URL already read here
│   ├── schema/
│   │   └── events.ts          # NEW — Drizzle table definition for the event log
│   └── events/
│       └── log.ts             # NEW — append + readFrom, the contract's implementation
├── scripts/
│   └── migrate.ts             # NEW — the documented migration command's entrypoint
└── test/
    ├── events.test.ts         # NEW — unit-level shape and validation checks
    └── events.integration.test.ts  # NEW — append, cursor read-back, 50-writer concurrency
```

**Structure Decision**: The existing monorepo layout from TASK-0010 is used unchanged.
All new code lands in `apps/server` — the event log is server-side persistence with no
client surface in this feature. Schema definitions go in `src/schema/` and the data-access
seam in `src/events/`, keeping the table definition separate from the operations over it
so TASK-0014 can add auth tables under `src/schema/` without touching this feature's
append logic. Nothing is added to `packages/shared`: the log's types are server-internal
until TASK-0015 needs to put event shapes on the wire, and adding a shared surface before
there is a second consumer would be speculative.

## Complexity Tracking

> No Constitution Check violations. This section is empty by design.

All nine gates pass without justification. The feature adds one table, one dev dependency
that the constraints table's ORM row already implies, and no new service.
