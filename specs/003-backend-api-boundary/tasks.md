# Tasks: API Boundary Hardening for Session Messages

**Input**: Design documents from `/specs/003-backend-api-boundary/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, the live runtime files under `apps/api/app/`, and the existing tests under `apps/api/tests/`

**Tests**: This feature is expected to add or tighten focused runtime tests. The package should also stay internally consistent as a spec bundle, but the implementation work is code-first.

**Organization**: Tasks are grouped by the runtime slice so the next implementation step can land route, service, and test hardening together.

## Requirement Traceability

| Requirement | Story | Validation target |
|-------------|-------|-------------------|
| FR-001, FR-002 | US1 | `apps/api/app/routes_sessions.py` keeps `POST /sessions/{session_id}/messages` thin and explicit, with `ChatMessageEnvelope` as the response contract. |
| FR-003, FR-004 | US2 | `apps/api/app/chat_session_service.py` and `apps/api/app/routes_sessions.py` preserve the route/service split and stable public error mapping. |
| FR-005, FR-006, FR-007 | US3 | `apps/api/app/schemas.py`, `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_sessions.py` prove the route boundary and dependency override seams. |
| FR-008, FR-009 | Setup and Polish | The bundle stays code-first, with docs and wiki references kept secondary and no new wiki deliverable taking the lead. |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is a read-only validation with no dependency on incomplete tasks
- **[Story]**: Which user story the task belongs to (`US1`, `US2`, `US3`)
- Every task description includes an exact file path or command

## Phase 1: Setup (Shared Runtime Baseline)

**Purpose**: Confirm the runtime seam inventory, the current test surface, and the package scope before making changes.

- [ ] T001 Confirm `apps/api/app/routes_sessions.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/schemas.py`, `apps/api/tests/test_sessions.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_contracts.py` are the primary implementation targets for the session-message boundary slice
- [ ] T002 [P] Read `specs/003-backend-api-boundary/spec.md`, `specs/003-backend-api-boundary/research.md`, `specs/003-backend-api-boundary/data-model.md`, and `specs/003-backend-api-boundary/quickstart.md` to confirm the package is code-first and centered on the runtime boundary
- [ ] T003 [P] Read `.omo/notepads/backend-phase-01-api-boundary/learnings.md` and capture the runtime seam inventory that supports the session-message slice

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the seam shape and contract vocabulary that the story tasks rely on.

**CRITICAL**: No story task should start until this phase is complete.

- [ ] T004 Verify the current `POST /sessions/{session_id}/messages` route shape in `apps/api/app/routes_sessions.py` and map the named dependency providers that tests can override
- [ ] T005 [P] Verify the public response contract in `apps/api/app/schemas.py` for `ChatMessageEnvelope`, `ChatMessageRead`, and related session-message models
- [ ] T006 [P] Verify the service seam in `apps/api/app/chat_session_service.py` so the route work can stay thin and the workflow stays HTTP-agnostic

**Checkpoint**: The runtime boundary shape is understood well enough to harden the route and tests without broadening scope.

---

## Phase 3: User Story 1 - Keep the session message route a thin public boundary (Priority: P1) MVP

**Goal**: The route stays a thin boundary and delegates the durable session-message workflow to the service seam.

**Independent Test**: A reviewer can read `apps/api/app/routes_sessions.py` and `apps/api/app/chat_session_service.py` and see that the route owns HTTP mechanics while the service owns the durable workflow.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Refactor `apps/api/app/routes_sessions.py` so `POST /sessions/{session_id}/messages` routes through a first-class service seam instead of any ad hoc dynamic import wrapper
- [ ] T008 [US1] Keep `apps/api/app/routes_sessions.py` returning `ChatMessageEnvelope` and preserve the route-level dependency wiring for chat, graph, retrieval, DB, settings, and auth
- [ ] T009 [US1] Tighten `apps/api/tests/test_contracts.py` so the session-message contract assertion proves the route boundary still emits the same public envelope shape

**Checkpoint**: The session message route is still thin, but the route-to-service seam is now explicit enough to harden safely.

---

## Phase 4: User Story 2 - Lock the public error contract for the session message boundary (Priority: P1)

**Goal**: The public error mapping stays stable for missing sessions and expected service failures.

**Independent Test**: A reviewer can exercise the message route and see stable public-safe `404`, `500`, and `503` responses without internal detail leakage.

### Implementation for User Story 2

- [ ] T010 [P] [US2] Keep `apps/api/app/routes_sessions.py` mapping missing sessions to `404 Session not found` and route/service failures to the documented public-safe messages
- [ ] T011 [P] [US2] Add or tighten assertions in `apps/api/tests/test_sessions.py` so missing-session behavior stays public and predictable
- [ ] T012 [US2] Add or tighten assertions in `apps/api/tests/test_chat_rag.py` and `apps/api/tests/test_contracts.py` so retrieval or chat failures still resolve to the expected public statuses and details

**Checkpoint**: The boundary exposes stable public errors and does not leak service internals.

---

## Phase 5: User Story 3 - Keep route tests isolated through dependency overrides (Priority: P2)

**Goal**: Route tests stay isolated and readable through named dependency overrides.

**Independent Test**: A reviewer can inspect the test fixtures in `apps/api/tests/test_sessions.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_contracts.py` and see that dependency overrides drive the route boundary.

### Implementation for User Story 3

- [ ] T013 [P] [US3] Keep `apps/api/tests/test_sessions.py` using `TestClient(app)` and `app.dependency_overrides` so the route boundary can be exercised without live collaborators
- [ ] T014 [P] [US3] Keep `apps/api/tests/test_chat_rag.py` using the named route dependency providers as override seams for fake embedding, Qdrant, chat, graph, and retrieval collaborators
- [ ] T015 [US3] Keep `apps/api/tests/test_contracts.py` focused on the public boundary so the envelope and route contract remain easy to verify

**Checkpoint**: The tests are isolated, readable, and clearly tied to the runtime boundary instead of to internals.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirm the package stays code-first, append the rescope note, and verify that the package matches the runtime slice.

- [ ] T016 [P] Append a concise rescope note to `.omo/notepads/backend-phase-01-api-boundary/learnings.md` explaining that the feature is now centered on `POST /sessions/{session_id}/messages` and the supporting route/service/test seams
- [ ] T017 [P] Run `rg -n "wiki|docs/wiki|preflight|postflight" specs/003-backend-api-boundary` and confirm the package no longer treats wiki output as the primary deliverable
- [ ] T018 [P] Run `rg -n "POST /sessions/\\{session_id\\}/messages|ChatMessageEnvelope|dependency_overrides|Session not found|503|500" specs/003-backend-api-boundary apps/api/app apps/api/tests` and confirm the package vocabulary matches the runtime boundary
- [ ] T019 [P] Run `sed -n '1,220p' specs/003-backend-api-boundary/spec.md`, `sed -n '1,220p' specs/003-backend-api-boundary/research.md`, `sed -n '1,220p' specs/003-backend-api-boundary/data-model.md`, and `sed -n '1,220p' specs/003-backend-api-boundary/quickstart.md` to confirm the package is internally consistent

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all story work
- **User Story 1 (Phase 3)**: Depends on Foundational completion, MVP scope
- **User Story 2 (Phase 4)**: Depends on User Story 1 because it preserves the same route boundary while locking public error mapping
- **User Story 3 (Phase 5)**: Depends on User Story 2 because the route and error shape need to be stable before the test seam is finalized
- **Polish (Phase 6)**: Depends on all desired story work being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational, no dependency on the other stories
- **User Story 2 (P1)**: Starts after User Story 1, no dependency on User Story 3
- **User Story 3 (P2)**: Starts after User Story 2, no dependency on new routes or broader API work

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup because they are read-only checks against different sources
- T005 and T006 can run in parallel during Foundational because they verify distinct runtime seams
- T007 and T008 can run in parallel once the seam shape is confirmed because one focuses on the route wiring and the other on the public response contract
- T010, T011, and T012 can run in parallel for error mapping because they target different test surfaces
- T013, T014, and T015 can run in parallel for dependency override isolation because they touch distinct test files
- T016 through T019 can run in parallel during Polish because they are append-only or read-only verification steps

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Verify the route still behaves like a thin boundary and still returns `ChatMessageEnvelope`

### Incremental Delivery

1. Complete Setup and Foundational tasks so the seam and contract vocabulary are clear
2. Complete US1 to lock the route/service split
3. Complete US2 to lock the public error contract
4. Complete US3 to keep route tests isolated through dependency overrides
5. Complete Polish tasks to align the package language with the runtime slice and append the rescope note

### Review-Only Guardrail

Do not expand this feature into unrelated routes, database migrations, worker changes, frontend changes, or a wiki-first contract rewrite. If a mismatch is found, fix the runtime seam or the tests that protect it rather than widening scope.

---

## Notes

- This package is code-first, so runtime route and test hardening are the primary deliverables
- `POST /sessions/{session_id}/messages` is the central slice; the companion session read path stays optional and only exists to keep the boundary coherent
- The wiki and docs remain supporting context only
