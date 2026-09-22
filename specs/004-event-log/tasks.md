---

description: "Task list for the session event log"
---

# Tasks: Database foundation — Drizzle, migrations, and the session event log

**Input**: Design documents from `/specs/004-event-log/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/event-log.md, quickstart.md

**Tests**: REQUIRED for this feature. FR-014 mandates automated tests for append, ordered
cursor read-back, and concurrent appends; board AC#6 says the same. Research D2 further
requires the concurrency tests run against a **real** database — a fake cannot exhibit the
property they exist to prove.

**Organization**: Tasks are grouped by user story so each can be implemented and verified
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths are given in every task

## Path Conventions

Monorepo from TASK-0010. All work lands in `apps/server/` per plan.md's Structure Decision.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make Drizzle's migration workflow exist before any schema is written.

- [x] T001 Add `drizzle-kit` as a devDependency in `apps/server/package.json` and run `pnpm install` from the repo root
- [x] T002 Create `apps/server/drizzle.config.ts` pointing at `src/schema/`, output dir `drizzle/`, dialect postgresql, reading `DATABASE_URL` from the environment
- [x] T003 Add `db:generate` and `db:migrate` scripts to `apps/server/package.json` per research D3 (generate compiles schema to SQL; migrate applies committed SQL)
- [x] T004 Declare `DATABASE_URL` in `turbo.json` `globalEnv` if not already present, so Turborepo cache correctness holds for the new scripts

**Checkpoint**: `pnpm --filter @the-stacks/server db:generate --help` runs without error.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema and the migration that creates it. Every user story depends on this.

⚠️ No user story can start until this phase completes.

- [x] T005 Define the `events` table in `apps/server/src/schema/events.ts` per data-model.md: `session_id` uuid, `seq` bigint, `actor` text, `type` text, `payload` jsonb, `payload_version` integer, `visibility` text defaulting to the public marker, `ts` timestamptz defaulting to now — all NOT NULL
- [x] T006 Declare the composite primary key `(session_id, seq)` and the check constraints `seq > 0` and `payload_version > 0` in `apps/server/src/schema/events.ts`
- [x] T007 Add the Drizzle client to `apps/server/src/db.ts`, reusing the existing pool wiring rather than opening a second connection path (spec Assumptions). **Do not remove or alter the existing `pool.on("error")` handler** — the T016 finding documents the crash its absence caused
- [x] T008 Generate the initial migration with `pnpm --filter @the-stacks/server db:generate` and **commit the generated SQL and journal** under `apps/server/drizzle/`
- [x] T009 Add the append-only guard to the migration (data-model.md): a trigger function rejecting `UPDATE` and `DELETE` on `events`, wired as a BEFORE trigger. Hand-add this to the generated migration file, since it is not expressible in the Drizzle schema
- [x] T010 Create `apps/server/scripts/migrate.ts` running Drizzle's migrator against `DATABASE_URL`, exiting nonzero on failure with the error message

**Checkpoint**: `docker compose up -d db` then `pnpm --filter @the-stacks/server db:migrate` creates the table; running it twice is a no-op (FR-011, SC-006).

---

## Phase 3: User Story 1 — Record a session's happenings and replay them in order (Priority: P1) 🎯 MVP

**Goal**: Append an event and read a session's stream back in order from a cursor.

**Independent test**: Append several events to one session, read from the origin cursor,
confirm the same events return in append order.

### Tests for User Story 1

- [ ] T011 [P] [US1] Write `apps/server/test/events.integration.test.ts` covering append-then-read-back: appended events return in ascending `seq` order starting at 1
- [ ] T012 [P] [US1] Extend that file with cursor tests: reading from cursor 3 of a 5-event session returns exactly events 4 and 5 (strictly-after semantics, contracts/event-log.md)
- [ ] T013 [P] [US1] Extend with the empty-result test: a cursor at or beyond the newest position returns an empty list, not an error (FR-009)
- [ ] T014 [P] [US1] Extend with the `limit` test: a read never returns more than the caller's maximum (FR-007)
- [ ] T015 [US1] Add the loud-skip harness to the integration test file: when no `DATABASE_URL` is reachable, tests skip with a **printed notice**, never a silent pass (research D2)

### Implementation for User Story 1

- [ ] T016 [US1] Implement `append` in `apps/server/src/events/log.ts` per contracts/event-log.md: accepts sessionId, actor, type, payload, payloadVersion, optional visibility; rejects caller-supplied `seq` or `ts`; returns the recorded event
- [ ] T017 [US1] Implement `readFrom` in `apps/server/src/events/log.ts`: takes sessionId, optional `afterSeq` defaulting to 0, required `limit`; returns events strictly after the cursor in ascending order, unfiltered by visibility or type (FR-012)

**Checkpoint**: US1 tests pass against a real database. The feature is usable on its own.

---

## Phase 4: User Story 3 — Append safely while several writers act at once (Priority: P2)

**Goal**: Concurrent appends to one session produce a gapless, duplicate-free run.

**Independent test**: Drive 50+ simultaneous appends at one session; confirm the count
equals the number of appends and positions form an unbroken ascending run.

**Sequenced before US2** because it completes the append path US1 began; US2 (migrations)
is already exercised by every test in this phase and US1.

### Tests for User Story 3

- [ ] T018 [US3] Add the concurrency test to `apps/server/test/events.integration.test.ts`: fire at least 50 concurrent appends at one session, then assert `count == max(seq) == count(distinct seq)` (quickstart.md step 4)
- [ ] T019 [P] [US3] Add the cross-session independence test: concurrent appends to two sessions number each session's positions independently (FR-003)
- [ ] T020 [US3] **Prove the concurrency test fails without the lock.** Temporarily remove the advisory lock from the append path, watch T018 fail, restore it. A test that passes either way is worse than none. Record the observed failure in the PR body

### Implementation for User Story 3

- [ ] T021 [US3] Wrap `append` in a transaction taking `pg_advisory_xact_lock` keyed per session (research D1), computing `seq = COALESCE(MAX(seq), 0) + 1` inside it. Use the two-argument form with a fixed namespace key so this feature's locks cannot collide with another advisory-lock user
- [ ] T022 [US3] Hash non-integer session identifiers into the lock's integer key, with a comment noting that a hash collision serializes two sessions — a performance effect, never a correctness one (research D1, Collision note)

**Checkpoint**: 50-writer concurrency holds (SC-003), and T020 has proven the test has teeth.

---

## Phase 5: User Story 2 — Stand up the schema on a fresh database (Priority: P2)

**Goal**: One documented command brings an empty database to the current schema.

**Independent test**: Run the command against an empty database; confirm the schema exists.
Run it again; confirm it changes nothing.

### Tests for User Story 2

- [ ] T023 [P] [US2] Add a test asserting the append-only guard is enforced **at the database**: a direct `UPDATE` and a direct `DELETE` against `events` are both rejected (FR-004, data-model.md)

### Implementation for User Story 2

- [ ] T024 [US2] Document the migration command in `apps/server/README.md` (create if absent) — prerequisites, the command, and the expectation that a second run is a no-op
- [ ] T025 [US2] Verify idempotency by hand: run `db:migrate` twice against a fresh database, confirm the second run applies nothing and exits 0 (SC-006). Record the output in the PR body

**Checkpoint**: A self-hoster reaches the full schema with one command (SC-001).

---

## Phase 6: User Story 4 — Carry who may see an event, and which shape it has (Priority: P3)

**Goal**: Visibility and payload version survive the round trip; unknown values are returned.

**Independent test**: Append events with differing visibility markers and payload versions;
confirm both come back unaltered and an unrecognized version is still returned.

### Tests for User Story 4

- [ ] T026 [P] [US4] Add the round-trip test: visibility and payloadVersion survive append and read unchanged (FR-005, FR-013)
- [ ] T027 [P] [US4] Add the default-visibility test: an append omitting visibility records the public marker, never null (FR-013)
- [ ] T028 [P] [US4] Add the unknown-tolerance test: an event with an unrecognized `type` and an unrecognized `payloadVersion` is still returned by a read (FR-012, constitution IV)

### Implementation for User Story 4

- [ ] T029 [US4] Confirm `append` defaults visibility when omitted and that `readFrom` applies no type or version filtering — implemented in T016/T017; this task is verification against the three tests above, not new code

**Checkpoint**: All four user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Add unit-level tests in `apps/server/test/events.test.ts` for input validation that needs no database (rejecting caller-supplied `seq`/`ts`, requiring the mandatory fields)
- [ ] T031 Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` in the worktree and paste the literal output into the PR body — this is the evidence standing in for the CI TASK-0017 has not built
- [ ] T032 Run the full `quickstart.md` validation end to end, including the manual `psql` checks in step 4

### Constitution Compliance (the-stacks)

- [ ] T033 Event types versioned, with visibility present on every event (Principle IV) — verified by T026–T028
- [ ] T034 Reads tolerate unknown and future event types (Principle IV) — verified by T028
- [ ] T035 Agent-facing interface exercised by a test, not only a human path (Principle I) — the append/read seam is the only interface and every test drives it
- [ ] T036 `docker compose up` still works from a clean clone (Principle IX) — verify after the schema and migration land

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies
- **Phase 2 (Foundational)** → depends on Phase 1. **Blocks every user story.**
- **Phase 3 (US1)** → depends on Phase 2
- **Phase 4 (US3)** → depends on Phase 3 (extends the append path US1 creates)
- **Phase 5 (US2)** → depends on Phase 2; runs after Phase 4 by convenience, not necessity
- **Phase 6 (US4)** → depends on Phase 3
- **Phase 7 (Polish)** → depends on all user story phases

### User Story Dependencies

- **US1 (P1)** — foundational. Everything else builds on its append/read path.
- **US3 (P2)** — extends US1's append with concurrency safety.
- **US2 (P2)** — independent of US1 in principle (it is the migration workflow), but every
  US1 test already exercises it, so it verifies rather than introduces.
- **US4 (P3)** — verification over US1's implementation; no new code path.

### Parallel Opportunities

- T011–T014 are separate test cases and can be written in parallel.
- T019, T023, T026–T028, T030 touch distinct test concerns and parallelize.
- **T005–T010 do not parallelize**: they are one schema, one migration, in sequence.
- **T016/T017 and T021/T022 do not parallelize**: same file, and T021 modifies what T016 writes.

## Implementation Strategy

### MVP scope

**Phase 1 + Phase 2 + Phase 3 (US1)** is the minimum that delivers value: a durable,
ordered, replayable event log. Everything after hardens or verifies it.

### Incremental delivery

Phases 3 → 4 → 5 → 6 each leave the feature working and testable. A checkpoint that fails
stops the phase rather than accumulating into the next.

## Notes

- **The concurrency tests are the load-bearing evidence.** A green suite whose skip notice
  says the database was unreachable proves nothing about AC#5. Read the output (D2).
- **T020 is not optional.** A regression test that passes with and without its fix is worse
  than no test, because it manufactures confidence. The sweep runbook requires the
  revert-and-watch-it-fail proof.
- **Do not add an index beyond the primary key** (data-model.md): it serves the only read
  this feature performs, and a redundant index taxes the hottest write path in the system.
