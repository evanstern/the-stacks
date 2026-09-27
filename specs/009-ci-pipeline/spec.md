# Feature Specification: CI pipeline with boundary check

**Feature Branch**: `task-0017-ci-pipeline`

**Created**: 2026-09-27

**Status**: Draft

**Input**: Board card TASK-0017 — "CI pipeline: lint, typecheck, test, build, and boundary
check" — plus three operator rulings recorded 2026-09-27 in
`docs/design/ci-rootguard-sweep-runbook.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every change is checked automatically (Priority: P1)

A contributor (human or agent) opens a pull request. Without anyone running anything by
hand, the project's full check set runs against it: lint, typecheck, test, and build. A
failure in any one marks the change red. The same run happens on every push to the
default branch, so `main` is never assumed green.

**Why this priority**: Today "green" is whatever an implementer pastes into a PR body.
This makes the gate mechanical and visible.

**Independent Test**: Open a PR with a deliberate lint error. The run fails. Fix it; the
run passes.

**Acceptance Scenarios**:

1. **Given** a pull request against the default branch, **When** it is opened or
   updated, **Then** the full check set runs and reports pass or fail on the PR.
2. **Given** a push to the default branch, **When** it lands, **Then** the same check
   set runs.
3. **Given** any one check fails, **When** the run completes, **Then** the run is
   reported failed.

---

### User Story 2 - Integration tests actually run (Priority: P1)

The auth, event-log, and WebSocket suites need a real database. Locally they skip loudly
when none is reachable. In the automated run a database is always provided, so these
suites run and never skip.

**Why this priority**: 42 of 72 tests skip without a database. A gate that skips them
proves nothing about sign-in, the event log, or the replay boundary. Operator ruling.

**Independent Test**: Inspect the run's test summary: zero skipped.

**Acceptance Scenarios**:

1. **Given** the automated run, **When** tests execute, **Then** every integration
   suite runs and the summary reports zero skipped tests.
2. **Given** the database does not come up, **When** tests execute, **Then** the run
   fails rather than skipping silently to green.

---

### User Story 3 - Forbidden imports fail the build (Priority: P1)

Architecture A3 splits state into three planes — Library, Codex, Session — and the
constitution says "a forbidden cross-plane import is a CI failure, not a review comment".
Package boundaries matter too: the web app must never import the server, and the shared
package imports no app. The check enforces both, and proves it can fire.

**Why this priority**: Plane discipline erodes by accident, one convenient import at a
time. Only Session code exists today, so the rule must be in place before the other
planes arrive.

**Independent Test**: A committed fixture that violates a rule is checked in the run and
must be reported as a violation; the run fails if the fixture is NOT flagged.

**Acceptance Scenarios**:

1. **Given** web-app code imports from the server app, **When** the check runs,
   **Then** it fails naming the file and import.
2. **Given** shared-package code imports from any app, **When** the check runs,
   **Then** it fails.
3. **Given** code in one plane imports another plane's internals, **When** the check
   runs, **Then** it fails.
4. **Given** the committed violating fixture, **When** the run executes, **Then** the
   run confirms the check flags it, and fails if it does not.
5. **Given** today's codebase, **When** the check runs, **Then** it passes.

---

### User Story 4 - Test files are typechecked (Priority: P2)

Server test files are currently outside typechecking; a type error in a test is invisible
until that test runs. They are brought under the typecheck step, and any errors this
exposes are fixed.

**Why this priority**: Closes a gap the grounding wiki records against this task.
Operator ruling.

**Independent Test**: Introduce a type error in a server test file; typecheck fails.

**Acceptance Scenarios**:

1. **Given** a type error in `apps/server/test/`, **When** typecheck runs, **Then** it
   fails.
2. **Given** today's tests after this change, **When** typecheck runs, **Then** it
   passes.

---

### User Story 5 - Reproduce the run locally, and grow it later (Priority: P2)

A contributor runs one documented command and gets the same verdict CI would give. A
later milestone adds a new suite (retrieval evals in M1, system-module conformance in M3)
by adding one entry, without restructuring the pipeline.

**Why this priority**: Card ACs #4 and #5. A gate nobody can reproduce gets argued with.

**Independent Test**: Run the documented command on a clean checkout with the database
up; it passes, and its steps match the automated run's.

**Acceptance Scenarios**:

1. **Given** a clean checkout and the documented prerequisites, **When** the documented
   command runs, **Then** it executes the same checks as CI and exits nonzero on any
   failure.
2. **Given** a new suite to add, **When** a contributor follows the documented extension
   point, **Then** the suite runs in CI and locally with no change to other steps.
3. **Given** the root-guard hook's regression tests exist, **When** the run executes,
   **Then** they run as part of the check set.

### Edge Cases

- A PR from a branch whose base has moved: the run checks the PR's merge result.
- Two pushes in quick succession on one PR: the older run is cancelled.
- The database service is slow to become ready: the run waits for readiness, bounded.
- Migrations fail to apply: the run fails before tests.
- The boundary fixture must not break the normal lint/typecheck/build of the real code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The automated run MUST trigger on pull requests to the default branch and
  on pushes to the default branch.
- **FR-002**: The run MUST execute lint, typecheck, test, and build; any failure MUST
  fail the run.
- **FR-003**: The run MUST provide a Postgres 17 database with pgvector, apply the
  project's migrations, and run the integration suites with zero skips.
- **FR-004**: A boundary check MUST fail on: the web app importing the server app; the
  shared package importing any app; one plane importing another plane's internals.
- **FR-005**: The boundary check MUST add no new dependency.
- **FR-006**: A committed violating fixture MUST prove the boundary check fires; the run
  MUST fail if the fixture is not flagged. The fixture MUST NOT affect the real code's
  checks.
- **FR-007**: Server test files MUST be included in typecheck; errors exposed MUST be
  fixed.
- **FR-008**: One documented command MUST reproduce the run's check set locally.
- **FR-009**: The pipeline MUST expose one documented extension point for new suites.
- **FR-010**: The run MUST execute the root-guard hook's regression tests when present.
- **FR-011**: Superseded runs on the same PR MUST be cancelled.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to run the full check set with
  the same single command a human uses, and read its verdict from the exit code.
- **CR-003** (III. Data planes, adapted): a forbidden cross-plane import MUST fail the
  automated run, per the constitution's own wording.

CR-002, CR-004, and CR-005 do not apply: no content entity, library claim, game
mechanic, or rulebook content is involved.

### Key Entities

- **Check set**: the ordered list of checks the run executes; the extension point adds
  to it.
- **Boundary rule**: a (source zone, forbidden target) pair — zones are packages today
  and planes as they appear.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of PRs and default-branch pushes after merge receive an automated
  verdict.
- **SC-002**: The run's test summary shows 0 skipped tests.
- **SC-003**: The violating fixture is flagged on every run; removing the rule turns
  the run red.
- **SC-004**: The documented local command and the automated run agree on pass/fail for
  the same commit.
- **SC-005**: Adding a new suite touches one declared place and no existing step.
- **SC-006**: A clean run completes in under 10 minutes.

## Assumptions

- Hosted CI is the repository host's built-in runner (GitHub Actions); the repository is
  private, and branch protection is unavailable on the current plan, so "must pass" is
  enforced by visible red status and review discipline, not by a merge block.
- Plane zones are declared now as directory conventions (future
  `apps/server/src/{library,codex,session}/`); only Session code exists, so plane rules
  are proven by the fixture rather than by real code.
- TASK-0018 merges first; this branch merges `main` in to pick up the hook tests.
- The M1/M3 suites themselves are out of scope; only the extension point is.
