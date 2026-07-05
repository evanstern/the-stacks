# Feature Specification: v3 Walking Skeleton

**Feature Branch**: `007-v3-skeleton`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "v3 walking skeleton: monorepo foundation for The Stacks v3 greenfield rebuild — pnpm workspace layout with package boundaries (shared domain types, DB schema, plugin contract), Docker compose stack (Postgres with pgvector, Fastify TypeScript API, React Router 7 SSR web app, Python inference-only ML sidecar), ORM/migration tooling with pgvector support, single-operator cookie auth, and one thin end-to-end slice proving every seam. Grounded in docs/v3-grounding/ (docs 03, 07, 08 — D1-D6, D12, D13)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Command Startup and Sign-In (Priority: P1)

The operator clones the repository, fills in a documented environment file, runs a single
start command, and gets the complete v3 system: every service comes up, the database
schema is prepared automatically, and the operator can sign in with their configured
credentials and land on a working home surface.

**Why this priority**: Nothing else in v3 can be built, demonstrated, or tested until the
system starts as one unit. "Boring infrastructure — the whole system starts with one
compose command" is a constitutional requirement (Principle VI), and this story is its
proof.

**Independent Test**: From a fresh clone with a populated environment file, run the
single documented start command, wait for readiness, sign in through the browser, and
see an authenticated landing page. No manual setup steps in between.

**Acceptance Scenarios**:

1. **Given** a fresh clone and a populated environment file, **When** the operator runs
   the single start command, **Then** all services start, schema preparation and model
   provisioning happen inside the startup lifecycle, and the system reports itself ready
   without any manual intervention.
2. **Given** the running system, **When** the operator submits the configured credentials,
   **Then** a persistent authenticated session is established and the operator reaches
   the authenticated home surface.
3. **Given** the running system, **When** sign-in is attempted with wrong credentials,
   **Then** access is refused with an honest, non-revealing message and no session is
   created.
4. **Given** the system was started once before, **When** the operator restarts it,
   **Then** it reaches ready state noticeably faster (no re-download/re-provision of
   already-present assets) and prior data is intact.

---

### User Story 2 - End-to-End Seam Verification (Priority: P2)

From the authenticated UI, the operator triggers a built-in "skeleton check". The check
is accepted immediately, runs in the background, and exercises every architectural seam
in one thin slice: UI → API → job queue → background worker → inference sidecar →
database (including storing and reading back a vector) → back to the UI as a visible,
inspectable result.

**Why this priority**: A walking skeleton is only real when a request provably crosses
every seam. This slice de-risks all future feature specs (ingestion, conversations,
retrieval) by proving the paths they will rely on, and it demonstrates the async-work and
event-trail doctrines (Principle IV) from day one.

**Independent Test**: With the stack running (User Story 1), trigger the skeleton check
from the UI and watch it progress from accepted → running → succeeded, then open its
record and see one event per seam crossed.

**Acceptance Scenarios**:

1. **Given** an authenticated operator, **When** they trigger the skeleton check,
   **Then** the request is accepted immediately with a trackable identity, and the
   operator can observe status progression without blocking the UI.
2. **Given** a triggered check, **When** it completes, **Then** its record shows an
   append-only event trail with one entry per seam (queued, claimed by worker, inference
   round-trip, vector stored, vector read back by similarity, completed), each with
   timing.
3. **Given** the check produced a stored vector, **Then** the stored record carries the
   identity of the embedding configuration that produced it (provider, model, dimensions).
4. **Given** the inference sidecar is stopped, **When** the operator triggers the check,
   **Then** the check fails legibly at that seam with a typed "dependency down" outcome —
   not a hang, not a generic error — and recovers on retry once the sidecar returns.

---

### User Story 3 - Developer Foundation: Boundaries, Migrations, and Tests (Priority: P3)

A developer working on any future v3 feature finds the foundation already in place:
shared definitions (domain types, storage schema, ingestion plugin contract) live in
dedicated packages consumed by the services that need them; schema changes are made as
versioned migrations that apply automatically; and one command runs the full verification
suite (core tests, web tests, type checks) with a passing baseline.

**Why this priority**: The skeleton's second job is to make every subsequent spec cheap.
Package boundaries prevent the cross-layer reach-through the constitution forbids
(Principle VI), and the testing posture (real suites from the start, one-command
verification) is a working agreement from the grounding package.

**Independent Test**: Run the single verification command on a fresh checkout: it
executes core and web test suites plus type checks and exits green. Add a trivial schema
migration and restart: it applies automatically.

**Acceptance Scenarios**:

1. **Given** a fresh checkout, **When** the developer runs the single verification
   command, **Then** core unit/integration tests, web app tests, and type checks all run
   and pass.
2. **Given** a new versioned schema migration, **When** the system next starts, **Then**
   the migration applies automatically inside the startup lifecycle and its application
   is recorded.
3. **Given** the shared definition packages, **When** the API and worker services build,
   **Then** both consume the same shared definitions rather than duplicating them, and
   the web layer consumes system capabilities only through the API contract.
4. **Given** the API error-mapping convention (unknown thing / unsupported type /
   dependency down / our bug), **When** contract tests run, **Then** the convention is
   pinned by at least one test per error class.

---

### Edge Cases

- A required service (database, sidecar, worker) is down or still starting: health
  reporting distinguishes starting / ready / failed per service, and the skeleton check
  fails legibly at the exact seam that is unavailable.
- The environment file is missing a required value: startup fails fast with a message
  naming the missing variable, rather than starting in a broken half-configured state.
- The configured embedding role changes between runs: previously stored vectors remain
  stamped with the configuration that produced them; the mismatch is detectable, never
  silent.
- v2 and v3 are started on the same machine: both stacks run simultaneously without
  port, container-name, or data-store collisions, and v2's documented contracts are
  untouched.
- Session cookie is absent, expired, or tampered with: all authenticated surfaces refuse
  access and route to sign-in; health/readiness endpoints remain reachable without auth.
- The system is restarted mid-check: the in-flight check either completes via the queue's
  retry semantics or fails legibly; it never disappears without a trace.

## Requirements *(mandatory)*

### Functional Requirements

**Startup & deployment**

- **FR-001**: The system MUST start completely — all services — from a fresh clone plus a
  populated environment file via one documented command, with no additional manual steps.
- **FR-002**: All provisioning that takes time (schema preparation, local model
  provisioning for the inference sidecar) MUST happen inside the startup lifecycle, not
  as documented manual steps.
- **FR-003**: Every service MUST expose health/readiness signals, and the system MUST
  distinguish starting, ready, and failed states per service.
- **FR-004**: Every externally published port and every environment-specific value MUST
  be configurable via environment variables with safe local defaults; no secrets may
  live in the repository.
- **FR-005**: The v3 stack MUST coexist with the running v2 stack on the same machine
  with zero interference (no shared ports, containers, or data stores), and MUST NOT
  modify v2 code or its documented runtime contracts.

**Authentication**

- **FR-006**: The system MUST provide single-operator sign-in with credentials supplied
  via environment configuration, establishing a persistent session bound to the browser
  (D13).
- **FR-007**: All application surfaces except health/readiness MUST require an
  authenticated session; failed sign-in MUST be refused with an honest, non-revealing
  message.

**Walking-skeleton slice**

- **FR-008**: The system MUST provide an operator-triggerable skeleton check that crosses
  every architectural seam in one run: UI → API → job queue → background worker →
  inference sidecar → database vector store (write and similarity read-back) → result
  visible in the UI.
- **FR-009**: The skeleton check MUST be asynchronous: accepted immediately with a
  trackable identity, processed in the background off the job queue, with status
  observable until completion (Principle IV).
- **FR-010**: Each check run MUST produce an append-only event trail with one entry per
  seam crossed, including timing, inspectable by the operator after the fact.
- **FR-011**: When any seam is unavailable, the check MUST fail with a typed outcome
  identifying the failed seam and cause class (dependency down vs. internal fault), and
  MUST succeed on a later run once the dependency returns, without manual repair.
- **FR-012**: Vectors stored by the skeleton check MUST carry deterministic identities
  derived from their input, so re-running the check is idempotent rather than
  duplicative.

**Model configuration**

- **FR-013**: The embedding role used by the skeleton check MUST resolve through a named,
  environment-first model configuration (provider kind, endpoint, model identity,
  parameters); no model identifier may be hardcoded (D14, Principle VII).
- **FR-014**: Every stored vector MUST be stamped with the identity of the embedding
  configuration that produced it (provider, model, dimensions), making vector-space
  mixing structurally detectable.

**Developer foundation**

- **FR-015**: Shared definitions — domain types, storage schema, and the ingestion plugin
  contract — MUST live in dedicated shared packages consumed by the services that need
  them, not duplicated per service. The plugin contract package MAY be a placeholder
  shape at this stage; its full schema belongs to the ingestion spec.
- **FR-016**: Storage schema changes MUST be expressed as versioned migrations that apply
  automatically during the startup lifecycle, with each application recorded.
- **FR-017**: The repository MUST provide one command that runs the full verification
  suite: core unit/integration tests, web app tests, and type checks, all passing on the
  delivered skeleton.
- **FR-018**: Contract tests MUST pin the API error-mapping convention (unknown thing /
  unsupported type / dependency down / internal fault) with at least one test per class.
- **FR-019**: The web layer MUST consume system capabilities only through the API
  contract; retrieval/evidence-side code MUST NOT depend on UI concerns (Principle VI).

### Key Entities

- **Operator Session**: The single operator's authenticated browser session; created on
  successful sign-in, required by all application surfaces, absent/invalid sessions are
  refused.
- **Skeleton Check Run**: One execution of the end-to-end seam verification; has a
  trackable identity, a status lifecycle (accepted → running → succeeded/failed), and an
  outcome typed by cause on failure.
- **Check Event**: One append-only entry in a run's event trail; records the seam
  crossed, timing, and outcome; never updated or deleted.
- **Model Role Configuration**: A named, environment-sourced description of a model role
  (initially: the embedding role) — provider kind, endpoint, model identity, parameters;
  referenced by name in product logic, never inlined.
- **Stored Vector**: The skeleton check's persisted embedding; carries a deterministic
  identity derived from its input and the identity of the model configuration that
  produced it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh machine with a populated environment file, the operator reaches
  a signed-in, ready system with one command in under 15 minutes on first start
  (including one-time provisioning) and under 3 minutes on subsequent starts.
- **SC-002**: The skeleton check, triggered from the UI, completes end-to-end in under
  60 seconds, and its record shows an event for every seam (queue, worker, inference,
  vector write, vector read-back).
- **SC-003**: With the inference sidecar deliberately stopped, a triggered check reports
  a dependency-down failure naming that seam in under 30 seconds, and a re-run after
  restart succeeds with no manual cleanup.
- **SC-004**: v2 and v3 stacks run simultaneously on one machine with zero collisions;
  all v2 documented smoke checks still pass while v3 is up.
- **SC-005**: A developer on a fresh checkout gets a green full-verification run with one
  command in under 10 minutes.
- **SC-006**: Zero secrets and zero hardcoded model identifiers in the repository;
  100% of published ports and environment-specific values are overridable via
  environment variables.
- **SC-007**: Re-triggering the skeleton check with identical input produces no duplicate
  stored vectors (idempotent re-runs), verified by record inspection.

## Assumptions

- The technology stack is fixed by constitution v2.0.0 and decisions D1–D6, D12, D13
  (TypeScript core with API/worker, Python inference-only sidecar, Postgres with
  pgvector, SSR web layer, Postgres-table queue, single-operator auth). This spec treats
  those as given; reopening any of them requires an ADR.
- Exact monorepo layout, package naming, ORM/migration tooling choice (pgvector support
  is a hard requirement), directory coexistence with v2, and the sidecar's HTTP contract
  are plan-level decisions — they are the doc-08 open questions assigned to this spec and
  will be answered in `/speckit-plan`.
- The background worker and job queue are in scope: the five-service topology in doc 03
  includes the worker, and the skeleton check exercises the queue seam that ingestion
  will later rely on.
- The skeleton check embeds a small fixed text via the configured embedding role; real
  ingestion, chunking, retrieval, and chat are explicitly out of scope (they are the
  next specs).
- Worktree port-block tooling (doc 07) is out of scope here — it is its own candidate
  spec — but this spec's ports-as-env requirement (FR-004) is a prerequisite for it.
- The Records observability surface is out of scope; the skeleton check's event trail is
  exposed through a minimal status view sufficient to satisfy FR-010, with the full
  Records rebuild owned by a later spec.
- Production-variant compose (internal-only database, single published port, pinned
  models) follows v2's pattern and is included only as configuration shape, not as a
  deployment exercise.
