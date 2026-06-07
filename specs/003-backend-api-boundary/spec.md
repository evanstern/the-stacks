# Feature Specification: API Boundary Architecture

**Feature Branch**: `[003-backend-api-boundary]`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Create Phase 1 of the backend refactor: API Boundary Architecture. This must be a real worktree-backed implementation feature, not a planning-only review. Add a durable docs/wiki/API Boundary Architecture.md page; update docs/wiki/Home.md reading order; update docs/wiki/Layer Boundaries.md only as needed to link or align with the new API boundary note. The feature must document route vs service ownership, dependency injection conventions, public error mapping, response schema and contract expectations, test seam expectations, and the required wiki preflight/postflight rule for future backend refactor phases. It must evaluate relevant wiki pages before and after the changes, update wiki frontmatter timestamps for changed pages, and include verification steps. Do not change runtime API behavior unless a small test-only contract clarification is required to lock existing behavior. Use OpenCode integration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintainer reads one API boundary contract before refactoring (Priority: P1)

As a backend maintainer, I need a durable API boundary wiki page that explains route ownership, service ownership, dependency injection, error mapping, response contracts, and test seams so every later backend refactor starts from the same architecture contract.

**Why this priority**: The backend refactor needs a stable architecture contract before code is moved across modules. Without a single API boundary note, later phases must reconstruct conventions from scattered wiki pages and route modules.

**Independent Test**: A reviewer can open `docs/wiki/API Boundary Architecture.md`, follow its links from `docs/wiki/Home.md`, and verify that it covers every required API boundary topic without needing to inspect planning chat history.

**Acceptance Scenarios**:

1. **Given** the current backend wiki, **When** the new API boundary page is read, **Then** it states which responsibilities belong in FastAPI routes and which belong in service modules.
2. **Given** future backend refactor work, **When** a maintainer checks the new page, **Then** it provides concrete expectations for dependency injection, public errors, response schemas, and tests.

---

### User Story 2 - Refactor phases evaluate wiki alignment before and after changes (Priority: P1)

As an implementation lead, I need every future backend refactor phase to have an explicit wiki preflight and postflight rule so code and architecture documentation stay synchronized as the backend is modularized.

**Why this priority**: The project treats `docs/wiki/` as durable architecture state. Backend changes that do not re-check and update the wiki create drift and make later work harder to scope.

**Independent Test**: The API boundary page includes a repeatable pre-change and post-change wiki checklist that a future Spec Kit plan can copy into implementation tasks.

**Acceptance Scenarios**:

1. **Given** a future backend refactor phase, **When** the phase begins, **Then** the API boundary page tells the implementer which wiki pages to evaluate before code changes.
2. **Given** a completed backend refactor phase, **When** the phase is reviewed, **Then** the page tells the reviewer how to verify the relevant wiki pages were updated or explicitly left unchanged.

---

### User Story 3 - Existing layer boundaries point to the new API-specific contract (Priority: P2)

As a reader of the architecture wiki, I need `Home.md` and `Layer Boundaries.md` to point to the API boundary contract so the API rules are discoverable from the existing architecture spine.

**Why this priority**: The existing wiki reading order is the project entry point. If the new API contract is not linked there, future agents may miss it and repeat the same architecture discovery.

**Independent Test**: A reviewer can start from `docs/wiki/Home.md`, follow the reading order to the API boundary page, and confirm `Layer Boundaries.md` links or aligns with it without duplicating large content.

**Acceptance Scenarios**:

1. **Given** a new reader starts at `docs/wiki/Home.md`, **When** they follow the architecture reading order, **Then** the API boundary page is included in the durable architecture spine.
2. **Given** a reader checks `docs/wiki/Layer Boundaries.md`, **When** API-specific ownership is mentioned, **Then** it links or points to the API boundary note rather than duplicating its details.

---

### Edge Cases

- What if the code and wiki disagree during preflight? The implementation must record the mismatch and either update wiki, change code, or leave a bounded follow-up note; it must not silently pick one source of truth.
- What if documenting the current API contract reveals missing tests? The feature may add small tests that lock existing behavior, but it must not intentionally change runtime API behavior.
- What if a boundary topic belongs to a layer-specific wiki page? The API boundary page should link to that page and summarize only the API-facing rule.
- What if a later refactor changes a boundary? That later phase must update the API boundary page and any relevant layer-specific page in the same branch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST add a durable `docs/wiki/API Boundary Architecture.md` page.
- **FR-002**: The API boundary page MUST document FastAPI route responsibilities versus service/module responsibilities.
- **FR-003**: The API boundary page MUST document dependency injection conventions for database sessions, settings, auth/session state, embeddings, Qdrant, retrieval, chat, and other external collaborators.
- **FR-004**: The API boundary page MUST document public error mapping expectations, including safe handling for common 400, 401, 404, 413, 415, and server-failure cases where current behavior provides examples.
- **FR-005**: The API boundary page MUST document response schema and public contract expectations, including the expectation that routes expose response models rather than internal ORM details.
- **FR-006**: The API boundary page MUST document test seam expectations for route tests, service tests, dependency overrides, and external collaborator fakes.
- **FR-007**: The API boundary page MUST define the required wiki preflight and postflight checks for future backend refactor phases.
- **FR-008**: The feature MUST update `docs/wiki/Home.md` so the API boundary page is discoverable from the architecture reading order.
- **FR-009**: The feature MUST update `docs/wiki/Layer Boundaries.md` only as needed to link or align with the API boundary page.
- **FR-010**: Any changed wiki page MUST have its frontmatter `updated` date refreshed.
- **FR-011**: The implementation MUST evaluate relevant wiki pages before and after the change and record the verification path in the feature artifacts or PR summary.
- **FR-012**: The feature MUST NOT change runtime API behavior, routes, schemas, database migrations, worker behavior, frontend behavior, or external service behavior.
- **FR-013**: The feature MAY add or adjust focused tests only when they lock already-existing API contract behavior discovered during documentation.
- **FR-014**: The feature MUST be implemented from a dedicated feature branch/worktree and must not make changes directly on deploy-only `main`.

### Key Entities *(include if feature involves data)*

- **API boundary note**: Durable wiki page describing the backend API route/service contract and verification expectations.
- **Route boundary**: FastAPI route modules that own HTTP request parsing, dependencies, status codes, and public response/error shapes.
- **Service seam**: Backend modules that own durable domain behavior outside HTTP mechanics.
- **Wiki preflight**: The required pre-change evaluation of `docs/wiki/Home.md`, `Layer Boundaries.md`, and phase-relevant layer pages.
- **Wiki postflight**: The required post-change re-evaluation and update of architecture pages after implementation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can verify all required API boundary topics are present in `docs/wiki/API Boundary Architecture.md`.
- **SC-002**: Starting from `docs/wiki/Home.md`, a reader can discover the new API boundary page through the architecture reading order.
- **SC-003**: `docs/wiki/Layer Boundaries.md` remains concise and links or aligns to the API boundary note without duplicating the full API contract.
- **SC-004**: Placeholder scans over the new spec artifacts and changed wiki pages return no unresolved template markers.
- **SC-005**: Git diff for the implementation shows no runtime API behavior changes unless explicitly justified as test-only contract clarification.
- **SC-006**: The implementation includes documented verification steps for wiki preflight, wiki postflight, and any focused tests that were run.

## Assumptions

- The durable API boundary note should be a new wiki page rather than a large expansion of `Layer Boundaries.md`.
- `Layer Boundaries.md` remains the cross-layer ownership map, while the new page owns API-specific route/service/test conventions.
- The current API architecture review in `specs/002-api-architecture-review/` is evidence for this feature but not itself the durable wiki contract.
- Future backend refactor phases will use this page as their wiki gate and may update it when they change stable API architecture.
- The current branch/worktree mechanism is sufficient for the worktree requirement as long as implementation occurs off `main`.
