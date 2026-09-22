# Feature Specification: Docker Compose stack — app and Postgres 17 with pgvector

**Feature Branch**: `task-0011-compose-stack`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Deliver the two-container compose stack from architecture A1: one Node app container and one Postgres 17 container with pgvector. Self-hosting is the distribution model, so 'docker compose up' working from a clean clone is a product requirement, not a convenience."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A stranger can run this project (Priority: P1)

Someone who has never seen this codebase clones it, follows a short README instruction,
and has a working install. They do not install Node, choose a Postgres version, hunt for
an extension, or read source to discover what configuration is required.

**Why this priority**: This IS the distribution model. Principle IX states that a setup
only the author can reproduce has not shipped. Every later feature is undeliverable to the
actual audience — public self-hosters — until this works.

**Independent Test**: On a machine with only Docker, clone the repo, copy the example
environment file, run one command, and observe both containers reach a healthy state.

**Acceptance Scenarios**:

1. **Given** a clean clone on a machine with only Docker installed, **When** the operator
   copies the example environment file and runs the documented start command, **Then**
   both the application and database containers start and report healthy.
2. **Given** the stack is running, **When** the operator inspects container status,
   **Then** the application's health is reported from its own health endpoint rather than
   merely "the process has not exited".
3. **Given** no environment file has been created, **When** the operator runs the start
   command, **Then** the failure names the missing configuration rather than surfacing an
   opaque connection error.

---

### User Story 2 - An operator's data survives restarts and upgrades (Priority: P1)

An operator stops the stack — for a machine reboot, an image upgrade, a configuration
change — and brings it back. Their campaigns, imported books, and session history are
still there.

**Why this priority**: Also P1, and deliberately so: a stack that loses data on restart is
not merely incomplete, it is harmful. The operator owns this content (Principle VIII) and
in the self-hosted model there is no other copy of it.

**Independent Test**: Write a value to the database, stop the stack entirely, start it
again, and read the value back.

**Acceptance Scenarios**:

1. **Given** data exists in the database, **When** the stack is stopped and started again,
   **Then** the data is still present.
2. **Given** the application container is rebuilt from a new image, **When** the stack
   restarts, **Then** database contents are unaffected.
3. **Given** an operator explicitly asks to remove the stack's data, **When** they run the
   documented teardown, **Then** the data is removed — deletion is possible, but never
   accidental.

---

### User Story 3 - The database is ready for what the project will need (Priority: P2)

The datastore supports vector similarity search, because the library plane's grounded
retrieval depends on it. An operator who sets up the stack today does not have to migrate
or reconfigure when that feature arrives.

**Why this priority**: P2 because M0 uses none of it — but the version and extension are
decided here, and changing a datastore after operators have real data in it is exactly the
migration this project should never ask of them.

**Independent Test**: Connect to the running database and confirm both the major version
and that the vector extension is available for use.

**Acceptance Scenarios**:

1. **Given** the stack is running, **When** the database version is queried, **Then** it
   reports major version 17.
2. **Given** the stack is running, **When** the vector extension is requested, **Then** it
   is available rather than missing.

---

### Edge Cases

- **Database slower to accept connections than the app is to start**: the app must not
  crash-loop permanently; the stack must converge to healthy without operator
  intervention.
- **Port already in use on the host**: the failure must name the conflict, and the port
  must be configurable without editing tracked files.
- **Stale named volume from an earlier version**: starting against existing data must
  not silently destroy it.
- **Operator edits the example environment file in place**: their real secrets must not
  become a tracked file staged for commit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST start a complete working install from a clean clone with a
  single documented command.
- **FR-002**: The system MUST run exactly two long-lived services — the application and
  the database — per the ratified two-container topology.
- **FR-003**: The database MUST be major version 17 with the vector extension available.
- **FR-004**: Database contents MUST persist across container stop, start, and application
  image rebuild.
- **FR-005**: All configuration MUST be supplied by environment variables, with a
  committed example file enumerating every variable the stack requires.
- **FR-006**: The committed example file MUST NOT contain real secrets, and the operator's
  filled-in copy MUST NOT be tracked by version control.
- **FR-007**: The application service MUST report health status derived from its own health
  endpoint, reflecting database reachability rather than process liveness alone.
- **FR-008**: The stack MUST converge to healthy without operator intervention when the
  database accepts connections later than the application starts.
- **FR-009**: The operator MUST have a documented way to remove the stack's persisted data
  deliberately, distinct from an ordinary stop.
- **FR-010**: Startup failure caused by missing configuration MUST name the missing
  configuration.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The stack MUST be startable, inspectable, and
  stoppable entirely through documented commands with no interactive-only step, so an
  agent can bring an environment up exactly as a human does.
- **CR-004** (VI. System-agnostic): The stack MUST encode no game-system assumption. It
  provides a runtime and a datastore.
- **CR-005** (VIII. Operator-owned content): The stack MUST ship no rulebook content, and
  all imported content MUST remain in the operator's own volume on their own machine.

*CR-002 (content contract) and CR-003 (citations) are deleted: this feature creates no
codex entity and makes no library-derived claim.*

### Key Entities

- **Stack configuration**: the set of environment variables the install requires —
  database credentials, connection coordinates, and host ports. Its committed example is
  the authoritative list of what an operator must provide.
- **Persisted data volume**: the operator's durable storage, holding everything they own.
  Survives every ordinary lifecycle operation; removable only deliberately.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person with only Docker installed, starting from a clean clone, reaches a
  working install by following at most three documented steps.
- **SC-002**: Both services report healthy within 2 minutes of the start command on a cold
  start that includes building the application image.
- **SC-003**: Data written before a full stop-and-start cycle is 100% readable afterward.
- **SC-004**: Every configuration value the stack needs appears in the committed example
  file — an operator never discovers a required variable by reading source or hitting a
  runtime error.
- **SC-005**: No real secret is present in any tracked file.

## Assumptions

- **The application's health endpoint is `GET /health`, owned by TASK-0013 (spec 003).**
  The sweep runbook fixes this seam contract before either task dispatches. It returns
  `200` in all cases with a body carrying an overall status plus separately readable
  process and database facts; **because it always returns `200`, a healthcheck that only
  inspects the HTTP status would report a database-down application as healthy — the body
  must be parsed.** The authoritative contract is `specs/003-hono-server/contracts/health.md`,
  restated here because spec 003 is on an unmerged sibling branch. Changing it is an
  operator checkpoint, not an implementer decision.
- **The application image builds on Node 22 with pnpm**, matching the pins TASK-0010
  committed (`engines`, `.nvmrc`, `packageManager`) so the container and a developer's
  host resolve identical toolchain versions.
- **No database schema exists yet.** Migrations and the event log are TASK-0012. This
  feature provides a running, extension-ready database; it creates no tables.
- **Single-tenant, single-host.** No orchestration beyond compose, no replication, no
  managed database — per the ratified topology.
- **The operator supplies their own model API keys later.** Model access is out of scope
  here; the configuration file may name the variables, but this feature needs none.
