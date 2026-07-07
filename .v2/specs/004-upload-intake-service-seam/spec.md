# Feature Specification: Upload Intake Service Seam

**Feature Branch**: `[004-upload-intake-service-seam]`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Create the next R2 implementation spec package for the upload intake boundary, ready for later coding. Build it as a concrete Spec Kit feature that focuses on the narrow upload-orchestration seam, not a broad ETL rewrite. Base the feature on R2 Option 2: a small upload-intake service seam that keeps routes_uploads.py focused on HTTP adaptation and public response mapping. Keep public upload behavior unchanged unless the spec explicitly says otherwise. Preserve existing seams: archive_storage.py, archive_repair.py, and ingestion.py stay in place. The spec must be concrete enough for implementation later: include user stories, functional requirements, success criteria, edge cases, and testing guidance. Include the exact route/file boundaries: routes_uploads.py, routes_archives.py, archive_storage.py, archive_repair.py, ingestion.py, test_uploads.py, test_contracts.py."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep upload intake as a thin HTTP boundary (Priority: P1)

As a backend maintainer, I need `routes_uploads.py` to stay focused on HTTP adaptation so the route parses requests, wires dependencies, maps public responses, and leaves the upload orchestration seam to a service boundary.

**Why this priority**: The upload route already mixes validation with orchestration pressure. If the seam is not tightened now, later upload and archive changes will keep landing in the wrong place.

**Independent Test**: A reviewer can inspect `apps/api/app/routes_uploads.py`, the new upload-intake service seam, and the upload route tests to confirm the route delegates orchestration instead of growing more branch logic.

**Acceptance Scenarios**:

1. **Given** a `POST /uploads` request, **When** the route handles it, **Then** the route remains responsible for request parsing, dependency wiring, public status codes, and response mapping while the service seam owns the upload-intake workflow.
2. **Given** a route-level test override, **When** the upload endpoint is exercised, **Then** the route can swap the seam with a fake without monkeypatching internal helper functions.

---

### User Story 2 - Preserve the public upload contract while moving orchestration behind a seam (Priority: P1)

As an implementation lead, I need the new seam to leave public upload behavior unchanged unless the spec says otherwise so clients still see the same response shapes and safe errors for invalid, duplicate, unsupported, oversized, or missing uploads.

**Why this priority**: The route boundary is public. A seam move that changes status codes, response models, or error details would be a breaking change even if the code looks cleaner.

**Independent Test**: A reviewer can compare `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` before and after the change and see the same public response shapes, same safe error paths, and the same upload-status behavior.

**Acceptance Scenarios**:

1. **Given** an unsupported or oversized upload, **When** the route rejects it, **Then** the public error stays terse and safe and the response code stays aligned with the current contract.
2. **Given** a single upload, batch upload, or archive upload path, **When** the request succeeds, **Then** the public response shape stays the same unless the spec explicitly calls for a contract change.

---

### User Story 3 - Keep the existing helper seams and tests in place (Priority: P2)

As a backend test author, I need the upload-intake refactor to preserve `archive_storage.py`, `archive_repair.py`, and `ingestion.py` as live seams so the new service boundary reuses the current lower-level helpers instead of replacing them with a broader ETL rewrite.

**Why this priority**: The project already has useful helper seams. Replacing them would widen the change for no gain and would blur the boundary with ETL work that belongs elsewhere.

**Independent Test**: A reviewer can inspect `apps/api/app/archive_storage.py`, `apps/api/app/archive_repair.py`, `apps/api/app/ingestion.py`, `apps/api/tests/test_uploads.py`, and `apps/api/tests/test_contracts.py` and see that the upload-intake service calls across the existing seams instead of duplicating them.

**Acceptance Scenarios**:

1. **Given** an archive upload needs storage or repair help, **When** the upload-intake seam handles it, **Then** it delegates to `archive_storage.py` and `archive_repair.py` rather than moving archive logic into the route.
2. **Given** a successful upload that creates work for later processing, **When** the flow reaches job creation or handoff, **Then** `ingestion.py` remains the downstream seam and is not replaced by a new ETL design.

---

### Edge Cases

- What if a request is a batch upload? Keep the batch expansion behavior intact and move only the orchestration branch behind the seam.
- What if an archive upload needs repair or storage shaping? Keep that work behind `archive_storage.py` and `archive_repair.py`, not inside the route handler.
- What if a request fails validation before a job exists? Return the current public-safe upload error shape and do not leak helper internals.
- What if route tests need a collaborator fake? Prefer a named dependency seam or service facade over monkeypatching helper internals.
- What if `routes_archives.py` is involved? Treat it as a companion boundary for archive viewing and asset delivery, not as the upload-intake orchestrator.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST center on the upload intake boundary in `apps/api/app/routes_uploads.py`, with `POST /uploads` as the primary runtime slice.
- **FR-002**: `apps/api/app/routes_uploads.py` MUST stay a thin HTTP boundary that owns request parsing, dependency composition, response model selection, status mapping, and public error translation.
- **FR-003**: The upload-intake service seam MUST own the orchestration currently pressured into the route, including the choice between single upload, batch upload, and archive-intake handling.
- **FR-004**: `apps/api/app/archive_storage.py` and `apps/api/app/archive_repair.py` MUST remain active helper seams for archive-specific work and MUST not be collapsed into the route.
- **FR-005**: `apps/api/app/ingestion.py` MUST remain the downstream handoff seam for post-upload work and MUST not be replaced by a broader ETL redesign in this feature.
- **FR-006**: The public upload contract MUST stay stable by default, including response shapes, status codes, and safe error details for invalid, duplicate, unsupported, oversized, or missing uploads.
- **FR-007**: `apps/api/app/routes_archives.py` MUST remain a companion boundary only, with no expansion of archive viewer responsibilities into the upload-intake seam.
- **FR-008**: `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` MUST cover the route boundary, public contract, and seam delegation with focused assertions.
- **FR-009**: The feature MUST stay narrow and MUST NOT expand into queue, retrieval, chat, corpus, or a broad ETL rewrite.
- **FR-010**: The implementation MUST be concrete enough for later coding, with user stories, requirements, edge cases, and verification anchors that directly map to the upload boundary files.

### Key Entities *(include if feature involves data)*

- **Upload intake route boundary**: `apps/api/app/routes_uploads.py` as the HTTP entrypoint for upload requests.
- **Upload-intake service seam**: The small service or facade that owns upload orchestration behind the route.
- **Archive helper seams**: `apps/api/app/archive_storage.py` and `apps/api/app/archive_repair.py` as the existing archive-specific helpers.
- **Ingestion handoff seam**: `apps/api/app/ingestion.py` as the downstream control-flow handoff after upload intake.
- **Upload contract tests**: `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` as the public boundary checks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can trace `POST /uploads` from `routes_uploads.py` into the upload-intake seam and see a clear route-versus-service split.
- **SC-002**: The public upload behavior stays unchanged unless a story explicitly says otherwise, including response shapes and safe error mapping.
- **SC-003**: `archive_storage.py`, `archive_repair.py`, and `ingestion.py` remain visible seams in the implementation path.
- **SC-004**: Focused tests in `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` cover the route boundary and contract shape without needing a broad ETL rewrite.
- **SC-005**: The spec package stays narrow, concrete, and ready for implementation without drifting into unrelated API areas.

## Assumptions

- The current upload contract is stable enough to harden behind a seam before any larger refactor.
- The new seam can live as a small service or facade adjacent to the upload route without changing public behavior.
- Archive-specific behavior stays split across the existing helper seams.
- Later code changes should be verified first against `test_uploads.py` and `test_contracts.py`, then against the route and service modules.
