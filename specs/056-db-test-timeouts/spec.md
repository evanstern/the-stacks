# Feature Specification: DB integration tests survive full-suite load

**Feature Branch**: `task-0154-db-test-timeouts`

**Created**: 2026-10-28

**Status**: Ready for plan. Clarify skipped: the card and the code settle every choice but one,
recorded as OQ-1 with a default.

**Input**: TASK-0154 "DB integration tests time out at 5 s under full-suite load". The server's
DB-backed scene and playtest integration tests pass reliably under a full
`REQUIRE_DATABASE=1` run, with no single re-runs.

**Board task**: TASK-0154 (m-3, priority low). In the M3 sweep order it runs first of the
remaining tasks: TASK-0154 → TASK-0168 → TASK-0161 → TASK-0167 → TASK-0165 → the TASK-0053 demo.

## Evidence and cause (from the card and the code)

Observed in the M3 sweep, 2026-10-27, each under a full `REQUIRE_DATABASE=1` run:

| Test | Seen on | Under load | Alone |
|---|---|---|---|
| `apps/server/test/dm/scene.integration.test.ts` "plays Greyhollow Ford to its end through exploration, social and fight" | TASK-0116 Phase 2; TASK-0051 (5090 ms) | timed out at 5 s | about 3 s, passed on one re-run |
| `apps/server/test/playtest/harness.integration.test.ts` | TASK-0051 Phase 2 | timed out at 5 s | about 3 s, passed on one re-run |
| `apps/server/test/playtest/provider.integration.test.ts` | TASK-0116 Phase 3 | timed out at 5 s | passed alone (3 tests) |

One contributing cause is already fixed: a per-turn full-log replay in `gate.recordPresence`
(2b09a07, TASK-0051, on main). The other instances stand.

What the code shows:

- No test in these three files sets a timeout, so each runs under vitest's 5 s default.
- Each test plays a whole scripted scene through the real queue, gate and DM worker. The
  worker drain loop waits 50 ms per idle tick (`apps/server/test/dm/worker-world.ts`). Alone,
  a test needs about 3 s, which is 60% of its budget.
- `apps/server/vitest.config.ts` already sets `fileParallelism: false`. Server test files never
  run concurrently with each other.
- The root `pnpm test` is `turbo run test`. Turbo runs the server, web, engine, session-model
  and srd suites at the same time. Other sweep lanes' stacks and test runs share the host.
  The "load" is CPU contention from outside the server's own vitest process.
- Heavy server tests already carry explicit per-test timeouts in the same style:
  `gate.integration.test.ts` (30 s, 60 s), `bench/load-db.integration.test.ts` (30 s),
  `library/uploads.integration.test.ts` (120 s), `bench/retrieval.integration.test.ts` (120 s).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A full DB run passes first time (Priority: P1)

An implementer or the orchestrator runs the full `REQUIRE_DATABASE=1` suite on a worktree
stack while other lanes work. The scene and playtest integration tests pass on the first run.
Nobody re-runs a file and reports it as a known flake.

**Why this priority**: every DB-touching PR in the sweep runs this suite. A false red costs a
re-run, a report line and reviewer doubt each time.

**Independent Test**: three consecutive full runs, each green with no re-run (card AC #2).

**Acceptance Scenarios**:

1. **Given** a migrated worktree stack and only `TEST_DATABASE_URL` exported, **When** the
   full `REQUIRE_DATABASE=1` run executes three times in a row, **Then** all three runs pass
   and none needs a re-run.
2. **Given** a scene or playtest integration test that genuinely hangs, **When** the suite
   runs, **Then** the test still fails on its own explicit timeout, inside a bounded time.

---

### User Story 2 - Each timeout states its reason (Priority: P2)

A reader of a timed test sees the budget, the measured figure it came from and the card that
set it, without opening the board.

**Why this priority**: an unexplained large timeout invites the next person to cut it, or to
copy it onto a test that does not need it.

**Independent Test**: read each changed test. Each timeout has one comment that names
TASK-0154 and the measured worst case.

**Acceptance Scenarios**:

1. **Given** a test whose timeout this task sets, **When** a reader opens the file, **Then**
   one comment names TASK-0154 and the measured worst case behind the number.

### Edge Cases

- The baseline measurement run does not reproduce a timeout. The sizing rule then uses the
  5 s breach the card already records as the worst case floor (FR-003).
- The baseline run shows another DB test over half the 5 s default. That test is in scope
  and gets a timeout by the same rule (FR-002).
- A full run fails on a test this task does not touch, such as the known WebSocket gateway
  flake. The run does not count toward the three (OQ-1 default (a)).
- A `beforeEach` or `afterAll` hook times out. Vitest's hook budget is 10 s. That failure is
  out of this task's rule and goes to the orchestrator as a finding.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every DB test in `scene.integration.test.ts`, `harness.integration.test.ts` and
  `provider.integration.test.ts` MUST set an explicit per-test timeout. (AC #1)
- **FR-002**: Any other server DB test whose measured duration in the baseline full run
  exceeds 2.5 s MUST set an explicit per-test timeout by the same rule. (AC #1)
- **FR-003**: Each timeout MUST be sized from the measured worst case: three times the larger
  of the measured under-load duration and 5 s, rounded up to the next 10 s, and never below
  30 s. (AC #1)
- **FR-004**: Each timeout MUST carry one comment naming TASK-0154 and the measured worst case.
- **FR-005**: The suite-wide default timeout MUST stay at vitest's 5 s. No change to
  `apps/server/vitest.config.ts`.
- **FR-006**: No test assertion, fixture or production source changes.
- **FR-007**: The baseline measurement and the three full runs MUST be committed as evidence
  under `specs/056-db-test-timeouts/evidence/`. (AC #2)
- **FR-008**: Three consecutive full `REQUIRE_DATABASE=1` runs MUST pass with no re-run. A
  failing run restarts the count. (AC #2)

### Constitution-Driven Requirements *(mandatory)*

Only workflow rules apply. The feature touches no game mechanics, content, citations or
interfaces, so rows CR-001 to CR-005 of the template do not apply.

- **CR-006** (Quality gates, "CI is the gate"): lint, typecheck, test, build and the
  boundary check MUST stay green.
- **CR-007** (Quality gates, "Grounding stays fresh"): the `test-suite` wiki note MUST
  describe the load-sized timeouts and be re-pinned.

## Card acceptance criteria map

| Card AC | Met by |
|---|---|
| #1 explicit timeout sized to measured worst case, or isolation | FR-001 to FR-005 (timeouts chosen; isolation rejected in plan.md) |
| #2 three consecutive full runs pass without re-runs | FR-007, FR-008 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Three consecutive full DB runs pass with zero re-runs.
- **SC-002**: Every named test has at least three times its measured worst-case duration as
  budget.
- **SC-003**: A genuinely hung test still fails within its own timeout, at most 2 minutes.
- **SC-004**: Zero changes to non-test source files and to the suite-wide default timeout.

## Assumptions

- The full run is `REQUIRE_DATABASE=1 pnpm test` from the worktree root (turbo, every package
  in parallel). That is the condition under which every instance was seen.
- The orchestrator runs every DB suite. The auto-mode classifier denies implementers the
  `TEST_DATABASE_URL` export (runbook, 2026-10-28 TASK-0163 row).
- Host load from other lanes varies. The 3x headroom and 30 s floor absorb it.
- `gate.recordPresence` stays fixed by 2b09a07. This task does not re-profile the DM pipeline.

## Open questions

- **OQ-1**: does a full run count toward AC #2 when its only failure is a test this task does
  not touch, such as the known WebSocket gateway flake? Options: (a) no, the run does not count
  and the count restarts; (b) yes, with the flake named in the evidence. **Default (a)**: the
  card's AC says "without re-runs" and draws no exception. If the flake blocks three clean
  runs, the orchestrator reports it rather than widening the AC.
