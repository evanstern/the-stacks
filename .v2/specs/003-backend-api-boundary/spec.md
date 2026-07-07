# Feature Specification: API Boundary Hardening for Session Messages

**Feature Branch**: `[003-backend-api-boundary]`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Rewrite the feature package so it becomes an action-oriented, code-first Spec Kit bundle titled API Boundary Hardening for Session Messages. Center the scope on POST /sessions/{session_id}/messages and, only if needed to keep the boundary coherent, the companion session read path. Preserve the route versus service seam, public error mapping, response model contract, and clean dependency overrides in tests. Treat docs and wiki pages as supporting context only. The package should be concrete enough that the next implementation step produces runtime code and tests, not more wiki pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep the session message route a thin public boundary (Priority: P1)

As a backend maintainer, I need `POST /sessions/{session_id}/messages` to stay a thin HTTP boundary so the route only handles request parsing, dependency wiring, status mapping, and public response shape while the durable session-message workflow stays in the service seam.

**Why this priority**: This is the narrowest runtime slice that still proves the boundary contract. If the route and service seam drift, future chat and retrieval changes become harder to test and easier to break.

**Independent Test**: A reviewer can inspect `apps/api/app/routes_sessions.py`, `apps/api/app/chat_session_service.py`, and `apps/api/tests/test_contracts.py` and confirm the route delegates to a named seam, returns `ChatMessageEnvelope`, and keeps public error handling in the route boundary.

**Acceptance Scenarios**:

1. **Given** a request to `POST /sessions/{session_id}/messages`, **When** the route handles the request, **Then** the route stays responsible for auth, dependencies, public status codes, and `response_model`, while the service seam owns the durable chat workflow.
2. **Given** a route-level or test override of the chat seam, **When** the message endpoint is exercised, **Then** the override can swap in a fake without reaching into service internals.

---

### User Story 2 - Lock the public error contract for the session message boundary (Priority: P1)

As an implementation lead, I need the session message route to keep stable public errors so missing sessions, unavailable retrieval dependencies, and incomplete persisted turns fail with predictable HTTP responses and public-safe details.

**Why this priority**: This route is a public API seam. If it leaks service internals or changes status mapping unexpectedly, the client contract and the tests that protect it become unreliable.

**Independent Test**: A reviewer can inspect `apps/api/app/routes_sessions.py`, `apps/api/app/chat_session_service.py`, `apps/api/tests/test_sessions.py`, and `apps/api/tests/test_chat_rag.py` and verify the same public statuses and error details are asserted end to end.

**Acceptance Scenarios**:

1. **Given** the session does not exist, **When** the route receives a message request, **Then** it returns `404 Session not found` without exposing internal state.
2. **Given** the retrieval or chat backend is unavailable, **When** the route or service fails in an expected way, **Then** it returns the documented `503` or `500` shape without leaking a traceback or storage detail.

---

### User Story 3 - Keep route tests isolated through dependency overrides (Priority: P2)

As a backend test author, I need route tests to use `TestClient(app)` and `app.dependency_overrides` so I can validate the boundary without binding tests to live embedding, Qdrant, or chat infrastructure.

**Why this priority**: The route is only hard to trust if it cannot be isolated. Clean override seams are what let us harden the boundary without turning route tests into integration tests.

**Independent Test**: A reviewer can read the route tests in `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_sessions.py` and see that the boundary is exercised through dependency overrides, not monkeypatching service internals.

**Acceptance Scenarios**:

1. **Given** a route test needs a fake chat or retrieval collaborator, **When** the test runs, **Then** it can override the named provider and keep the route contract unchanged.
2. **Given** a route test finishes, **When** the fixture tears down, **Then** dependency overrides are cleared so the next test starts from a clean boundary.

---

### Edge Cases

- What if the session read path is needed to keep the boundary coherent? Keep it in scope only as the read-side companion to message creation, not as a separate feature.
- What if the route and service disagree on the public error shape? Keep the route mapping public-safe and stable, then pin the behavior with tests before any deeper refactor.
- What if tests need to fake a collaborator? Prefer a named FastAPI dependency provider or a route-local facade seam over direct monkeypatching.
- What if the service returns incomplete persisted data? Treat that as an internal failure and keep the public response terse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The implementation MUST harden `POST /sessions/{session_id}/messages` as the primary runtime slice for this feature, with the session read path included only if needed to keep the route boundary coherent.
- **FR-002**: `apps/api/app/routes_sessions.py` MUST keep the route boundary explicit, with request parsing, dependency wiring, status mapping, and `response_model=ChatMessageEnvelope` staying at the route layer.
- **FR-003**: `apps/api/app/chat_session_service.py` MUST remain the service seam that owns the durable session-message workflow, retrieval orchestration, and persisted turn assembly.
- **FR-004**: The route boundary MUST preserve public-safe error mapping for missing sessions and expected service failures, including the current `404`, `500`, and `503` public contract surfaces where they already exist.
- **FR-005**: `apps/api/app/schemas.py` MUST remain the source of truth for the public response contract, and the route MUST not expose internal ORM rows or service objects directly.
- **FR-006**: Tests MUST use named FastAPI dependency seams, `TestClient(app)`, and `app.dependency_overrides` to isolate the route boundary from live collaborators.
- **FR-007**: `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_sessions.py` MUST cover the route boundary, service seam, and error mapping with focused assertions.
- **FR-008**: The feature SHOULD keep docs and wiki references minimal and secondary, using them only as supporting context for the code-first slice.
- **FR-009**: The next implementation step produced from this package MUST be runtime code and tests, not more wiki pages.

### Key Entities *(include if feature involves data)*

- **Session message route boundary**: `POST /sessions/{session_id}/messages` and its companion read-side session path, if needed, as the public HTTP seam.
- **Chat session service seam**: `apps/api/app/chat_session_service.py` as the durable workflow owner behind the route.
- **Dependency override seam**: Named FastAPI dependency providers in `apps/api/app/routes_sessions.py` that tests can replace cleanly.
- **Public error contract**: The public `HTTPException` mapping for missing sessions and expected retrieval or chat failures.
- **Response contract**: `ChatMessageEnvelope` and the `ChatMessageRead` shapes exposed through `schemas.py`.
- **Route/service test seam**: The split between route-level tests and service-level tests, with route tests using `TestClient` plus dependency overrides.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can trace `POST /sessions/{session_id}/messages` from `routes_sessions.py` into `chat_session_service.py` and see a clearly named route-to-service seam.
- **SC-002**: Focused tests in `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_sessions.py` cover the public response shape and the route boundary without needing live external services.
- **SC-003**: The public error mapping stays stable for missing sessions and expected retrieval or chat failures.
- **SC-004**: Dependency overrides remain clean, isolated, and easy to read, so the route boundary can be tested without reaching into service internals.
- **SC-005**: The spec package stays code-first, with supporting docs and wiki references used only as context rather than as the primary deliverable.

## Assumptions

- The route slice should stay narrow and should not expand into a broad API refactor across unrelated routes.
- The current public contract around session messages is stable enough to harden with tests before any larger service cleanup.
- The session read path only belongs in scope if it is needed to keep the message boundary readable and coherent.
- Supporting wiki notes may stay in the background, but they are not the deliverable that defines this feature.
