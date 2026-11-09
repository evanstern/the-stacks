# Feature Specification: Migrated stacks

**Feature Branch**: `task-0098-migrated-stacks`

**Created**: 2026-11-08

**Status**: Draft

**Input**: TASK-0098. `pnpm env:up` and `pnpm env:main` bring up a stack whose app database is
migrated, with no manual `db:migrate` step. Contract: `specs/010-worktree-stacks/contracts/env-cli.md`.
Runbook: `docs/design/r1-fast-table-runbook.md`, merge spine row 6, lane LP.

Authored against `.specify/templates/`. The spec number and branch were reserved, so the skills'
branch and directory steps were skipped. `speckit-clarify` was skipped: the card and its three
implementation notes settle the behavior. Three judgment calls remain; see Open questions.

## Scope

- **In**: `env up` and `env main` migrate the app database; `env up` also migrates the test
  database. Migration runs in a container on the stack's own compose network, so it needs no host
  toolchain and builds no credential string from `.env`. Each `up` verifies the applied migration
  count and fails when it is short. The ingest worker backs off after a failed loop iteration. Host
  `db:migrate` and `auth:create-operator` print the database they target. The env-cli contract
  documents where migration happens.
- **Out**: a self-hoster's plain `docker compose up` (OQ2). The vm-104 `dev` deploy, which already
  migrates through its own `migrate` service (`deploy/dev/compose.dev.yml`). Schema state in
  `/health` (OQ3).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A worktree stack comes up migrated (Priority: P1)

An implementer runs `pnpm env:up` in a fresh worktree. The app database and the test database both
hold every migration on the branch. The app serves, and `REQUIRE_DATABASE=1` suites run, with no
hand step.

**Why this priority**: every DB lane pays a hand migration at every gate. The documented host
command also migrated the wrong database (card note 1).

**Independent Test**: run `pnpm env:up` in a fresh worktree. In both databases, the row count of
`drizzle.__drizzle_migrations` equals the entry count of `apps/server/drizzle/meta/_journal.json`.

**Acceptance Scenarios**:

1. **Given** a fresh worktree, **When** `pnpm env:up` exits 0, **Then** both databases hold every
   migration the branch's journal lists.
2. **Given** a stack that is already up and migrated, **When** `pnpm env:up` runs again, **Then**
   migration is a no-op and the command exits 0.
3. **Given** a migration that fails, **When** `pnpm env:up` runs, **Then** it exits 1, names the
   failed database, and does not start the app service.

### User Story 2 - The local main stack comes up migrated (Priority: P1)

An operator runs `pnpm env:main`. The `stacks-main` app database holds every migration on
`origin/main`.

**Independent Test**: run `pnpm env:main`. The migration count in the `stacks-main` database equals
the journal's entry count at `origin/main`.

**Acceptance Scenarios**:

1. **Given** no `stacks-main` stack, **When** `pnpm env:main` exits 0, **Then** its app database
   holds every migration on `origin/main`.
2. **Given** `origin/main` gained a migration since the last run, **When** `pnpm env:main` runs,
   **Then** the new migration lands on the existing volume.

### User Story 3 - An unmigrated stack fails loudly (Priority: P2)

A stack whose database lacks migrations fails a check instead of passing as healthy. A missing
schema does not flood the logs.

**Independent Test**: a unit test of the count comparison fails a short count. A worker test shows
the ingest loop backs off against a database that throws.

**Acceptance Scenarios**:

1. **Given** a database whose migration count is below the journal's, **When** `env up` verifies it,
   **Then** `env up` exits 1 and prints both counts.
2. **Given** a database with no `jobs` table, **When** the ingest worker runs for 500 ms, **Then** it
   makes at most two claim attempts, not thousands.

### Edge Cases

- `env main` has no test stack. It migrates and verifies the app database only.
- The migrate image comes from the Dockerfile's `build` stage, which the app image build already
  runs. The second build is a layer-cache hit.
- `env down` and `env prune` remove the stack's migrate image, so no per-env image is left behind.
- A `.env` with JSON-valued keys still works: the migrate container reads only `DATABASE_URL`.
- A host `db:migrate` in a worktree still targets the test database. It now prints that target first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `env up` MUST migrate the app database before it starts the app service.
- **FR-002**: `env up` MUST migrate the test database after the test stack is healthy.
- **FR-003**: `env main` MUST migrate the `stacks-main` database to `origin/main` before it starts
  the app service.
- **FR-004**: Migration MUST run in a container on the target stack's compose network, built from
  the checkout being brought up. It MUST NOT build a connection string from `.env` passwords on the host.
- **FR-005**: After migration, `env up` and `env main` MUST compare each database's
  `drizzle.__drizzle_migrations` row count to the journal's entry count. A short count MUST exit 1.
- **FR-006**: A migration or verify failure MUST exit 1 and name the database (app or test).
- **FR-007**: `env down` and `env prune` MUST remove the stack's migrate image when present.
- **FR-008**: The ingest worker loop MUST wait `POLL_MS` after a failed iteration, as the DM worker does.
- **FR-009**: Host `db:migrate` and `auth:create-operator` MUST print the target host, port and
  database name before they act. They MUST NOT print the user or password.
- **FR-010**: `contracts/env-cli.md` MUST state where and when each database is migrated. It MUST
  give the in-container command that provisions an operator in the app database.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): an agent drives this feature with the same `pnpm env:*` commands a
  human uses. No Intent kind applies: this is developer tooling, not play.
- **CR-002** (XII. Self-hostable): the change MUST NOT add a service to `docker-compose.yml` or alter
  a plain `docker compose up`. OQ2 records the self-hoster gap this spec does not close.

Rows II to XI do not apply: the feature adds no Intent, event, view, mechanic, narration, content or
library claim.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 `env:up` leaves the app DB migrated to the branch's latest | FR-001, FR-004, FR-005; US1 |
| #2 `env:main` leaves the main DB migrated to `origin/main`'s latest | FR-003, FR-005; US2 |
| #3 a test or scripted check fails on an unmigrated stack | FR-005 (verify step in every `up`), its unit test in `check:scripts`, and the count assertion in `check:env`; US3 |
| #4 the env-cli contract documents where migration happens | FR-010 |

Card notes: note 1 (host migrate hits the test DB) is closed by FR-001 and FR-002, and surfaced by
FR-009. Note 2 (tight error loop) is FR-008. The create-operator note is FR-009 plus the FR-010
command (OQ1). Note 3 (different credentials) is moot: FR-004 uses the container's own `DATABASE_URL`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: a fresh `pnpm env:up` needs zero hand steps before `REQUIRE_DATABASE=1` suites pass.
- **SC-002**: both databases' migration counts equal the journal's after every successful `env up`.
- **SC-003**: an unmigrated database produces at most one ingest error line per `POLL_MS` (2 s).

## Assumptions

- The Dockerfile's `build` stage holds `apps/server/drizzle/` and `apps/server/scripts/migrate.ts`.
  `deploy/dev`'s `migrate` service already relies on this.
- Compose names a project's default network `<project>_default`. Both stacks name their database
  service `db`.
- The test stack uses the fixed throwaway credentials `stacks`/`stacks`/`stacks` (spec 020 R5).

## Open questions

- **OQ1 — explicit target for host CLIs.** The card note asks host CLIs for an explicit app-DB
  target. **Recommendation**: add no flag. Print the target (FR-009) and document
  `docker compose -p stacks-<env> exec app node dist/cli/create-operator.js` (FR-010). The runtime
  image ships that file, and `DATABASE_URL` governs inside the container.
- **OQ2 — a self-hoster's `docker compose up` is unmigrated too.** Constitution XII requires a
  working install from `docker compose up`, and the README quickstart has no migrate step.
  **Recommendation**: card it separately (migrate on app boot, or a default-profile migrate
  service). Either choice changes the vm-104 deploy order, a C9 surface.
- **OQ3 — `/health` over an empty schema.** **Recommendation**: leave `/health` unchanged. FR-005
  already blocks an unmigrated `up`, and a new health field changes a contract
  (`specs/002-compose-stack/contracts/healthcheck.md`).
