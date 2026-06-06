# Feature Specification: Live DB-Backed Queue Claim/Status Handling

**Feature Branch**: `[001-live-db-backed-queue]`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Document the current queue state only. Capture the live DB-backed claim/status flow in the queue layer, based on the Layer Boundaries and Queue Architecture docs. Explicitly exclude a brokered queue redesign, retry or cancel work, admin dashboards, and any ETL/chat/corpus ownership changes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator can understand the live queue boundary (Priority: P1)

As an operator or maintainer, I need the queue behavior documented as the current DB-backed claim/status flow so I know what the system actually does today and where that responsibility stops.

**Why this priority**: This is the core boundary the rest of the system depends on. If the queue is described incorrectly, later planning will drift into the wrong architecture.

**Independent Test**: A reader can verify the spec against the queue and layer-boundary wiki pages and confirm it describes the live DB-backed claim/status flow, not a future brokered queue.

**Acceptance Scenarios**:

1. **Given** the current queue docs and code, **When** I read the spec, **Then** I can tell the queue is DB-backed claim/status handling and not a standalone broker system.
2. **Given** a future queue redesign proposal, **When** I compare it to the spec, **Then** I can see that broker semantics are out of scope for this feature.

---

### User Story 2 - Operator can see how status moves through the boundary (Priority: P1)

As an operator, I need to understand how job status and claim state move through the queue boundary so I can reason about job visibility and processing without guessing which layer owns what.

**Why this priority**: Status is the user-visible contract of the current queue. It is the part operators depend on for monitoring and troubleshooting.

**Independent Test**: A reader can identify the source of truth for claim and status state, plus the surfaces that read or update that state, without needing implementation details.

**Acceptance Scenarios**:

1. **Given** a queued upload or ingestion job, **When** the spec describes its lifecycle, **Then** it refers to DB rows, claim transitions, and status fields as the live mechanism.
2. **Given** the queue boundary, **When** I look for ownership lines, **Then** ETL, chat, and corpus concerns remain outside the queue scope.

---

### User Story 3 - Planning can stay constrained to current reality (Priority: P2)

As a planner or future implementer, I need a durable spec that keeps queue work bounded so later tasks do not pull in retries, cancellation, admin dashboards, or ownership changes by accident.

**Why this priority**: The spec should prevent scope drift and keep future work aligned with the current architecture.

**Independent Test**: A reviewer can check the explicit out-of-scope list and confirm it excludes brokered redesign, retry or cancel flows, admin dashboards, and ETL/chat/corpus ownership changes.

**Acceptance Scenarios**:

1. **Given** a proposed enhancement, **When** it adds retry or cancel controls, **Then** the spec clearly marks that work as out of scope.
2. **Given** a proposed ownership change for ETL, chat, or corpus, **When** I compare it to the spec, **Then** the change is rejected as outside the queue boundary.

---

### Edge Cases

- What happens when a reader expects a brokered queue design? The spec must say that design is not part of the current scope.
- How does the spec handle legacy status behavior? It should describe the live DB-backed claim/status flow without rewriting the historical roadmap.
- What if a future task needs retries, cancel, or admin views? The spec must treat those as separate features.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The spec MUST describe the current queue as live DB-backed claim/status handling rather than a standalone brokered queue.
- **FR-002**: The spec MUST explain that queue state is represented by ordinary database rows and status transitions that the rest of the app reads.
- **FR-003**: The spec MUST identify the queue boundary as separate from ETL, chat, and corpus ownership.
- **FR-004**: The spec MUST state that the current queue behavior uses claim-and-status flow for live work visibility.
- **FR-005**: The spec MUST describe the operator-facing value of the queue boundary in plain language, without implementation-heavy detail.
- **FR-006**: The spec MUST explicitly exclude brokered queue redesign, retry controls, cancel controls, admin dashboards, and broader admin workflows.
- **FR-007**: The spec MUST explicitly exclude any ownership transfer into ETL, chat, or corpus layers.
- **FR-008**: The spec MUST include assumptions that the wiki and live code remain the source of truth for the current boundary.
- **FR-009**: The spec MUST remain concise enough to serve as a durable planning reference rather than a design implementation note.

### Key Entities *(include if feature involves data)*

- **Queue claim record**: The live database row or row state that marks a job as claimed for processing.
- **Job status row**: The persisted status information that operators and services read to understand whether work is queued, claimed, or otherwise in flight.
- **Upload batch**: The upload-level grouping whose state may be summarized from child job status.
- **Ingestion job**: The per-job record that moves through the current claim/status flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can read the spec and correctly identify the current queue as DB-backed claim/status handling without consulting implementation code.
- **SC-002**: The spec contains no unresolved clarification markers.
- **SC-003**: The spec clearly separates queue scope from broker redesign, retry or cancel, admin dashboards, and ETL/chat/corpus ownership.
- **SC-004**: The checklist derived from the spec covers each requirement area and can be validated as complete.

## Assumptions

- The live queue behavior remains the DB-backed claim/status flow documented in the current code and wiki.
- The queue spec is intentionally descriptive, not prescriptive about a future brokered architecture.
- Retry, cancel, admin dashboard, and ownership changes belong in separate specs if they are ever introduced.
- The current wiki pages are the durable boundary reference for this feature.
