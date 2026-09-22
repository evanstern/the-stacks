# Feature Specification: Hono HTTP server with health and one typed REST route

**Feature Branch**: `task-0013-hono-server`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Hono HTTP server with a health endpoint and one typed REST route, per board task TASK-0013 and architecture A1/A2."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The operator can tell whether their install is healthy (Priority: P1)

A self-hoster runs the stack and needs to know, without reading logs or opening a
database client, whether the application is actually working — both that the process is
up and that it can reach its database. A process that answers HTTP while its database is
unreachable is a failure the operator must be able to see.

**Why this priority**: This is the foundation of the self-hosting promise (Principle IX).
It is also the first thing the container orchestration needs — TASK-0011's compose
healthcheck consumes this and cannot be written without it. Shipped alone, it already
delivers value: an operator can verify an install.

**Independent Test**: Start the server against a reachable database and request health —
it reports healthy. Stop the database and request health again — it reports the database
unreachable rather than claiming health or hanging.

**Acceptance Scenarios**:

1. **Given** the server is running and the database is reachable, **When** a client
   requests the health endpoint, **Then** the response reports the process as running and
   the database as reachable.
2. **Given** the server is running and the database is NOT reachable, **When** a client
   requests the health endpoint, **Then** the response still returns promptly and reports
   the database as unreachable, rather than hanging or returning a success status.
3. **Given** a container orchestrator polls the health endpoint on an interval, **When**
   the database recovers, **Then** a subsequent poll reports healthy without a restart.

---

### User Story 2 - A client gets predictable, validated answers from the API (Priority: P2)

Any consumer of this API — a human's browser, or an agent driving the same interface —
sends a request and gets back either a well-formed answer that matches a declared shape,
or a well-formed error explaining what was wrong with the request. It never gets a raw
stack trace, and it never gets a success-shaped response containing invalid data.

**Why this priority**: This establishes the validation discipline every later route
inherits. It is P2 rather than P1 because health alone is a shippable slice, but no
feature route can be built before this pattern exists.

**Independent Test**: Send a valid request to the route and receive the declared response
shape. Send a malformed request and receive a structured error naming the problem, with
no stack trace and no partial success.

**Acceptance Scenarios**:

1. **Given** a client sends a well-formed request to the typed route, **When** the server
   processes it, **Then** the response matches the declared output shape.
2. **Given** a client sends a request with a missing or wrongly-typed field, **When** the
   server validates it, **Then** the response is a structured error identifying the
   invalid input, and no unvalidated data reaches the handler.
3. **Given** an unexpected failure occurs while handling a request, **When** the error
   propagates, **Then** the client receives the same consistent error shape rather than a
   raw stack trace or an unhandled crash.
4. **Given** an agent rather than a human drives the route, **When** it reads the declared
   input and output shapes, **Then** it can construct a valid request without a
   human-only affordance.

---

### Edge Cases

- **Database slow rather than down**: health must answer within a bounded time rather
  than blocking on a hung connection, so an orchestrator's poll does not time out
  ambiguously.
- **Health requested before the database pool is warm**: the endpoint reports honestly
  rather than erroring.
- **Error shape for a route that does not exist**: an unknown path returns the same
  structured error shape as any other failure, not a framework default page.
- **Validation failure vs. internal failure**: a client must be able to distinguish "you
  sent something wrong" from "something broke on our side".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST start a single HTTP server process as the server workspace's
  entrypoint.
- **FR-002**: The system MUST expose a health endpoint reporting both process liveness and
  database reachability as separately readable facts.
- **FR-003**: The health endpoint MUST answer within a bounded time even when the database
  is unreachable or slow.
- **FR-004**: The system MUST expose at least one REST route whose input and output are
  both validated against a declared schema.
- **FR-005**: The system MUST reject input that fails validation before it reaches any
  handler logic.
- **FR-006**: All errors returned to a client MUST share one consistent structured shape,
  and MUST NOT include stack traces or internal details.
- **FR-007**: A client MUST be able to distinguish a client-side validation failure from a
  server-side internal failure.
- **FR-008**: Automated tests MUST cover the health endpoint (both reachable and
  unreachable database) and the typed route (valid and invalid input).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The typed route MUST be drivable by an agent through the
  same declared input/output contract a human client uses. Its schema is the interface an
  agent reads to construct a valid call; no human-only affordance (form markup, session
  assumption, or undocumented field) may be required to use it.
- **CR-003** (V. Citations): Not applicable — this feature draws no claim from the
  library plane. No retrieval occurs here.
- **CR-004** (VI. System-agnostic): The route and the error shape MUST NOT encode any 5e
  or other game-system assumption. This is transport and validation scaffolding; game
  mechanics belong behind the system-module interface.
- **CR-005** (VIII. Operator-owned content): This feature ships and reproduces no rulebook
  content of any kind.

*CR-002 (content contract) is deleted: this feature creates no codex entity. The
three-section entity schema applies when the codex plane arrives in M2.*

### Key Entities

- **Health report**: what the health endpoint conveys — whether the process is serving,
  and whether its datastore is reachable, as separately readable facts rather than a
  single opaque verdict.
- **Structured error**: the single shape every failure takes — enough for a client to know
  what went wrong and whether it was their fault, and never enough to leak internals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can determine whether a fresh install is working by making one
  request, without reading logs or opening a database client.
- **SC-002**: The health endpoint answers within 5 seconds in every case, including when
  the database is unreachable — bounded so an orchestrator's poll interval never hangs
  ambiguously.
- **SC-003**: 100% of client-visible failures return the structured error shape; no
  response exposes a stack trace or internal path.
- **SC-004**: A consumer that has only the route's declared input and output shapes can
  construct a valid request and correctly interpret both a success and a validation
  failure, with no additional documentation.

## Assumptions

- **The seam contract with TASK-0011 is fixed before either task dispatches.** The sweep
  runbook names it: `GET /health` returning `200` with a body carrying an overall status
  plus separately readable process and database facts. TASK-0011's compose healthcheck is
  written against exactly this. Changing it is an operator checkpoint, not an implementer
  decision, because a change invalidates the sibling task already coded against it.
- **The database connection is configured by environment variables**, consistent with the
  self-hosting posture. This feature reads that configuration; TASK-0011 supplies it.
- **No authentication is in scope.** Session auth is TASK-0014. Both endpoints here are
  reachable without a session, and TASK-0014 later decides what becomes protected.
- **Schema migrations and the event log are out of scope** (TASK-0012). This feature needs
  only to establish that a database connection can be opened and a trivial query answered.
- **The typed route's subject matter is deliberately minimal.** Its purpose is to prove
  the validation seam, not to deliver a product capability. It must not anticipate the
  codex or session planes.
