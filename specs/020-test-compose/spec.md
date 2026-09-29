# Feature Specification: Test compose stack

**Feature Branch**: `task-0033-test-compose`

**Created**: 2026-09-29

**Status**: Draft

**Board task**: TASK-0033

**Input**: Separate DB-only test compose stack per worktree, with CI parity. Operator ruling
2026-09-29 (binding): tests get a separate compose file with a DB-only stack, not a second
database inside the prod-like `docker-compose.yml`. Ratified conditions: (1) the pgvector
image is pinned in exactly one place, shared by `docker-compose.yml`, the test compose file,
and CI; (2) the test stack stays inside the env machinery (project `stacks-task-<n>-test`,
its own port range, `org.the-stacks.*` labels, covered by `env:down` and `env:prune
--check`, `TEST_DATABASE_URL` written by `env:up` or a sibling verb); (3) it is its own task
and PR.

## Background

On TASK-0024 (#31) the per-worktree app stack's `app` container ran the ingest worker
against the same `jobs` table the host-run integration tests used. The worker claimed
test-enqueued jobs, could not see the host upload path, and failed them.
`worker.integration.test.ts` (T023) flaked in roughly 10–15% of local runs. CI never saw it:
its database is a bare service with no app beside it. The fix is structural isolation: the
app stack stays purely "run the app"; tests get their own throwaway database that looks like
CI's.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Integration tests never share a database with a running app (Priority: P1)

A developer (human or agent) in a worktree runs `pnpm env:up`, then runs the server's
integration suites. The suites connect to a database that no app process polls. A job a
test enqueues is only ever claimed by the test's own worker.

**Why this priority**: this is the defect. Until it holds, a green local run proves little
and a red one may be noise.

**Independent Test**: bring the app stack up, run `worker.integration.test.ts` 20 times in a
row with `REQUIRE_DATABASE=1`, and see 20 passes.

**Acceptance Scenarios**:

1. **Given** a worktree with `pnpm env:up` completed, **When** the developer reads `.env`,
   **Then** `TEST_DATABASE_URL` names the test stack's port, not the app stack's `DB_PORT`.
2. **Given** both stacks are up and the app stack's database is migrated, **When**
   `worker.integration.test.ts` runs 20 consecutive times, **Then** every run passes.
3. **Given** both stacks are up, **When** a developer lists containers for the worktree,
   **Then** the test stack has exactly one service (the database) and no app.

---

### User Story 2 - One image pin, local and CI alike (Priority: P1)

A maintainer bumps the Postgres/pgvector image. They edit one line. The app stack, the
test stack, and CI all pick the new image up with no second edit.

**Why this priority**: the ruling makes it a condition. Two copies of a pin drift, and a
drifted test database proves nothing about production.

**Independent Test**: change the image in its one home; resolve the test compose file and
confirm the new image; confirm CI's database step names no image of its own.

**Acceptance Scenarios**:

1. **Given** the repository, **When** it is searched for the pgvector image reference in
   tracked config (compose files and workflows), **Then** exactly one occurrence is found.
2. **Given** CI runs on a pull request, **When** its database starts, **Then** it starts
   from the test compose file, the same file a developer uses locally.
3. **Given** someone adds an image line to the test compose file or to CI, **When**
   `pnpm ci:check` runs, **Then** it fails and names the duplicate.

---

### User Story 3 - The test stack is a first-class env citizen (Priority: P2)

The test stack is created, listed, torn down, and orphan-reported by the same `env:*`
commands and Stop hook as every other stack. No new cleanup rule exists.

**Why this priority**: an unlabeled or uncovered stack leaks across worktree removal and
blocks the sweep's `env:prune --check` gate for someone else.

**Independent Test**: `env:up`, remove the worktree without `env:down`, run
`env:prune --check`; the test stack is named as an orphan.

**Acceptance Scenarios**:

1. **Given** a worktree `task-<n>`, **When** `pnpm env:up` completes, **Then** a compose
   project `stacks-task-<n>-test` is running with the three `org.the-stacks.*` labels.
2. **Given** both stacks are up, **When** `pnpm env:down` runs, **Then** both projects and
   all their resources are gone, and it exits 0.
3. **Given** a test stack whose worktree no longer exists, **When**
   `pnpm env:prune --check` runs, **Then** it exits 1 naming `stacks-task-<n>-test`.
4. **Given** only the pre-change app stack was ever up, **When** `pnpm env:down` runs,
   **Then** it exits 0 (a missing test stack is not an error).

---

### User Story 4 - The split is documented (Priority: P3)

A developer reading `.env.example`, the wiki, or the README learns there are two
databases per worktree and which one tests use.

**Why this priority**: required by AC #6; cheap once the behavior exists.

**Independent Test**: read `.env.example`, `docs/wiki/runtime-stacks.md`, and
`docs/wiki/test-suite.md`; each states the split and names `TEST_DATABASE_URL`'s target.

**Acceptance Scenarios**:

1. **Given** `.env.example`, **When** read, **Then** it documents `TEST_DB_PORT` and says
   `TEST_DATABASE_URL` points at the test stack.

### Edge Cases

- A worktree already up from before this change: its `.env` still points
  `TEST_DATABASE_URL` at the app database. `env:up` refuses while the app port is bound
  (existing behavior). The documented remedy is `pnpm env:down && pnpm env:up`.
- A worktree named so that `stacks-<env>-test` would equal another worktree's test project
  (a basename ending in `-test`): `env:up` refuses the name, as it already refuses `main`
  and `dev`.
- `env:main`: the local `origin/main` stack is for running the app. It gets no test stack.
- Running the test compose file by hand with no `-p`: its default project name must not
  equal the app stack's default project name.
- A developer running only unit tests: nothing changes; unit suites need no database.
- `pnpm db:migrate` and `pnpm auth:create-operator` on the host prefer
  `TEST_DATABASE_URL`, so after the split they target the test database. Targeting the app
  database takes an explicit override (see FR-010).
- The test database is on tmpfs: a container restart empties it; re-run migrations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A test compose file MUST define exactly one service, the database, and no app.
- **FR-002**: The test database's data MUST be throwaway: memory-backed storage, no named
  volume.
- **FR-003**: The Postgres/pgvector image MUST be named in exactly one tracked place.
  `docker-compose.yml`, the test compose file, and CI MUST all resolve it from there.
- **FR-004**: CI MUST start its database from the test compose file.
- **FR-005**: `pnpm env:up` in a worktree MUST start the test stack as compose project
  `stacks-<env>-test`, published on loopback at its own port, carrying the
  `org.the-stacks.env`, `org.the-stacks.worktree`, and `org.the-stacks.commit` labels.
- **FR-006**: The test port range MUST NOT collide with the app range (3000+n) or the app
  database range (15000+n), for numbered or hashed worktree names.
- **FR-007**: `pnpm env:up` MUST write `TEST_DATABASE_URL` pointing at the test stack, and
  `TEST_DB_PORT` naming its port.
- **FR-008**: `pnpm env:down` MUST remove the test stack as well as the app stack, and MUST
  exit 0 when either is absent.
- **FR-009**: `pnpm env:prune --check`, `pnpm env:prune`, `pnpm env:status`, and the Stop
  hook MUST treat the test stack like any other labeled stack.
- **FR-010**: The documentation MUST state how to target the app stack's database from the
  host (migrations, operator creation), since those scripts prefer `TEST_DATABASE_URL`.
- **FR-011**: A check in `pnpm ci:check` MUST fail when a second pgvector image reference
  appears in the test compose file or CI workflow.
- **FR-012**: A worktree basename ending in `-test` MUST be refused by `env:up`.
- **FR-013**: `worker.integration.test.ts` MUST pass 20 consecutive local runs with the app
  stack up, its database migrated, and `REQUIRE_DATABASE=1`.
- **FR-014**: `.env.example`, the `runtime-stacks` and `test-suite` wiki notes, and the
  README's "Checks" section MUST document the split.
- **FR-015**: No new runtime dependency and no new app-side toggle.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST drive the test stack through the same
  `pnpm env:*` commands a human uses; exit codes stay the machine contract.
- **CR-002** (IX. Self-hostable): A self-hoster's `docker compose up` MUST behave exactly as
  before. The test compose file is never loaded by default.

### Key Entities

- **Test stack**: a per-worktree compose project `stacks-<env>-test` with one database
  service on memory-backed storage, labeled with the worktree's identity.
- **Image pin**: the single tracked line naming the Postgres/pgvector image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `worker.integration.test.ts` passes 20 of 20 consecutive local runs with the
  app stack up (baseline: roughly 10–15% failure).
- **SC-002**: Changing the database image takes a one-line edit; zero other files change.
- **SC-003**: After `env:down`, zero labeled resources remain for either project of the
  worktree.
- **SC-004**: An orphaned test stack is reported by the same gate, with the same exit code,
  as an orphaned app stack.
- **SC-005**: CI stays green with 0 skipped database suites.

## Assumptions

- `docker compose` v2.24 or later (for `extends` with `!reset`/`!override`) is available
  locally and on GitHub's `ubuntu-latest` runners.
- `env:up` starting both stacks is acceptable: the test stack is one small database with no
  build, so its cost is seconds.
- The app stack keeps its ingest worker. With separate databases it has nothing of the
  tests' to claim, so no toggle is needed.
- Clarify was skipped: the operator ruling and the card settle every scope question; the
  remaining choices are technical and recorded in research.md.
