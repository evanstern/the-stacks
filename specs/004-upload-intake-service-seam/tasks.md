# Tasks: Upload Intake Service Seam

**Input**: Design documents from `/specs/004-upload-intake-service-seam/`

**Prerequisites**: `plan.md`, `spec.md`, `docs/wiki/Upload Intake Boundary.md`, `docs/wiki/API Refactor Roadmap.md`, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`; no unrelated ETL or queue artifacts are needed for this bounded upload feature.

**Tests**: The implementation should be verified with focused API tests, especially `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py`, plus any seam-specific test file added for the new upload-intake service.

**Organization**: Tasks are grouped by user story so each boundary change can be reviewed on its own.

## Requirement Traceability

| Requirement | Story | Validation target |
|-------------|-------|-------------------|
| FR-001 | US1 | `apps/api/app/routes_uploads.py` keeps `POST /uploads` as the primary upload-intake entrypoint. |
| FR-002 | US1 | `apps/api/app/routes_uploads.py` stays the HTTP adaptation layer with response mapping and status handling. |
| FR-003 | US1 | The new upload-intake seam owns single/batch/archive orchestration behind the route. |
| FR-004 | US2 | `apps/api/app/archive_storage.py` and `apps/api/app/archive_repair.py` remain the archive-specific helper seams. |
| FR-005 | US2 | `apps/api/app/ingestion.py` remains the downstream handoff seam after upload intake. |
| FR-006 | US2 | `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` keep the public upload contract stable. |
| FR-007 | US2 | `apps/api/app/routes_archives.py` remains a companion boundary, not part of upload orchestration. |
| FR-008 | US3 | `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` cover the route/service split with focused assertions. |
| FR-009 | US3 | The task set stays free of queue, retrieval, chat, corpus, and broad ETL scope. |
| FR-010 | US1 | The feature package remains implementation-ready and maps directly to the upload boundary files. |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is a read-only validation with no dependency on incomplete work
- **[Story]**: Maps task to user story from `spec.md`
- Every task includes an exact file path or command

## Phase 1: Setup (Shared Runtime Baseline)

**Purpose**: Confirm the current upload boundary and the spec package shape before route work begins.

- [ ] T001 Confirm `specs/004-upload-intake-service-seam/spec.md` and `plan.md` keep the scope centered on `routes_uploads.py` and the upload-intake seam
- [ ] T002 [P] Confirm `docs/wiki/Upload Intake Boundary.md` names the upload-orchestration decision and points to the new spec package path
- [ ] T003 [P] Confirm `docs/wiki/API Refactor Roadmap.md` marks R2 as the upload-intake service seam follow-up
- [ ] T004 [P] Confirm `docs/wiki/Home.md` and `docs/wiki/Layer Boundaries.md` stay short and do not repeat the full upload contract

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the seam and verification constraints that all story work depends on.

**CRITICAL**: No user story task should start until this phase is complete.

- [ ] T005 Define the upload-intake service seam shape in `apps/api/app/` so `routes_uploads.py` can delegate orchestration instead of carrying it inline
- [ ] T006 [P] Preserve `apps/api/app/archive_storage.py`, `apps/api/app/archive_repair.py`, and `apps/api/app/ingestion.py` as the lower-level helper seams the new boundary will call
- [ ] T007 [P] Map the route and contract test entrypoints in `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` so the seam can be verified without live collaborators
- [ ] T008 Verify the upload boundary still excludes queue, retrieval, chat, and corpus responsibilities before any code is moved

**Checkpoint**: The upload-intake boundary is pinned down and ready for the route/service split.

---

## Phase 3: User Story 1 - Keep upload intake as a thin HTTP boundary (Priority: P1) MVP

**Goal**: `routes_uploads.py` becomes the HTTP adapter for upload intake, not the workflow owner.

**Independent Test**: A reviewer can inspect `apps/api/app/routes_uploads.py` and see request parsing, dependency wiring, response-model selection, and status mapping separated from the upload-intake orchestration.

### Implementation for User Story 1

- [ ] T009 [US1] Route `POST /uploads` in `apps/api/app/routes_uploads.py` through the new upload-intake seam instead of keeping orchestration branch logic inline
- [ ] T010 [P] [US1] Keep `apps/api/app/routes_uploads.py` responsible for public response mapping and status codes while the seam returns route-ready outcomes
- [ ] T011 [P] [US1] Add or update the seam dependency provider in `apps/api/app/routes_uploads.py` so tests can override it with a fake
- [ ] T012 [US1] Update `apps/api/tests/test_uploads.py` to prove the route still behaves as the HTTP boundary after delegation

**Checkpoint**: The upload route is thin again and delegates the orchestration branch.

---

## Phase 4: User Story 2 - Preserve the public upload contract while moving orchestration behind a seam (Priority: P1)

**Goal**: The upload-intake seam lands without changing public behavior unless a later story explicitly says otherwise.

**Independent Test**: A reviewer can compare `apps/api/tests/test_uploads.py` and `apps/api/tests/test_contracts.py` and confirm the same response shapes, safe errors, and status expectations still hold.

### Implementation for User Story 2

- [ ] T013 [US2] Preserve the current public error mapping in `apps/api/app/routes_uploads.py` for unsupported, duplicate, oversized, invalid, and missing upload cases
- [ ] T014 [P] [US2] Keep `apps/api/app/routes_uploads.py` returning the same response shapes for single uploads, batch uploads, and archive uploads unless the spec calls for a contract change
- [ ] T015 [P] [US2] Verify `apps/api/app/routes_archives.py` stays limited to archive viewing and asset delivery while upload intake remains elsewhere
- [ ] T016 [US2] Lock the public upload contract in `apps/api/tests/test_contracts.py` so the new seam does not leak internal objects or status drift

**Checkpoint**: The seam is in place without a public contract break.

---

## Phase 5: User Story 3 - Keep the existing helper seams and tests in place (Priority: P2)

**Goal**: The upload-intake refactor reuses the current helper seams instead of replacing them with a broader ETL change.

**Independent Test**: A reviewer can inspect `apps/api/app/archive_storage.py`, `apps/api/app/archive_repair.py`, and `apps/api/app/ingestion.py` and see that they remain the lower-level seams behind upload intake.

### Implementation for User Story 3

- [ ] T017 [P] [US3] Confirm `apps/api/app/archive_storage.py` still owns archive storage concerns and is called from the new upload-intake seam when needed
- [ ] T018 [P] [US3] Confirm `apps/api/app/archive_repair.py` still owns archive repair and cleanup concerns and is called from the new upload-intake seam when needed
- [ ] T019 [P] [US3] Confirm `apps/api/app/ingestion.py` still receives the downstream handoff after upload intake instead of being replaced by new ETL logic
- [ ] T020 [US3] Add or adjust `apps/api/tests/test_uploads.py` assertions so the seam uses the existing helper modules instead of duplicating their behavior

**Checkpoint**: The helper seams remain intact and visible in the implementation path.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the final upload-boundary slice and keep the docs and tests aligned.

- [ ] T021 Run `python -m pytest apps/api/tests/test_uploads.py apps/api/tests/test_contracts.py` from the repo root and record the result for the upload boundary slice
- [ ] T022 Run a placeholder scan across `specs/004-upload-intake-service-seam` and the touched wiki pages, then confirm no unresolved markers remain
- [ ] T023 Run `git diff -- specs/004-upload-intake-service-seam docs/wiki` and confirm the change set stays limited to the intended spec and wiki files
- [ ] T024 Verify `apps/api/app/routes_uploads.py`, `apps/api/app/routes_archives.py`, `apps/api/app/archive_storage.py`, `apps/api/app/archive_repair.py`, and `apps/api/app/ingestion.py` still match the boundary described in the spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user story work
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational; no dependency on other stories, but should preserve US1 response terminology
- **User Story 3 (P2)**: Can start after Foundational; no dependency on other stories, but should preserve the same helper seams and route boundary language

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during Setup
- T006, T007, and T008 can run in parallel during Foundational
- T010, T011, and T012 can run in parallel for US1 after the seam exists
- T014, T015, and T016 can run in parallel for US2 once route delegation is stable
- T017, T018, and T019 can run in parallel for US3 because they confirm different helper seams
- T021, T022, T023, and T024 can run in parallel during Polish

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup checks.
2. Complete Phase 2 seam and boundary baseline.
3. Complete Phase 3 so `routes_uploads.py` delegates upload orchestration.
4. Stop and verify the route is thin before any broader cleanup.

### Incremental Delivery

1. Deliver US1 to separate HTTP adaptation from orchestration.
2. Deliver US2 to prove the public upload contract stayed stable.
3. Deliver US3 to confirm the existing helper seams remain the lower-level path.
4. Finish with polish checks and focused API test runs.

### Parallel Team Strategy

With multiple reviewers:

1. One reviewer can handle Setup and Foundational checks.
2. Another can wire the route/service seam in `routes_uploads.py`.
3. A third can lock the public contract in `test_uploads.py` and `test_contracts.py`.
4. Reconcile the route, helper seams, and tests before polishing the spec bundle.

---

## Notes

- This feature is intentionally narrow. Do not widen it into queue, retrieval, chat, corpus, or broad ETL work.
- Keep `archive_storage.py`, `archive_repair.py`, and `ingestion.py` alive as the lower-level seams the new upload-intake boundary calls.
- If a later implementation wants to move archive viewer behavior, that should be a separate feature centered on `routes_archives.py`.
- The upload boundary should remain public-safe by default. Any response-shape or status-code change needs to be explicit in a later story.
