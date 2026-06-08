# Tasks: Public API Error Mapping Convention

**Input**: Design documents from `/specs/005-public-api-error-mapping-convention/`

**Prerequisites**: `spec.md`, `plan.md`, `docs/wiki/API Boundary Architecture.md`, `docs/wiki/API Refactor Roadmap.md`, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, and the live route examples in `apps/api/app/auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`

**Tests**: Placeholder scan on changed markdown and spec files, then a docs-only git diff check

**Organization**: Tasks are grouped so the package can be drafted, checked, and closed without touching runtime code

## Requirement Traceability

| Requirement | Story | Validation target |
|-------------|-------|-------------------|
| FR-001, FR-002 | US1 | The package documents the public error convention and the covered status codes in one place. |
| FR-003, FR-004 | US1 | The package cites the live route examples and prefers observed repo behavior over generic theory. |
| FR-005, FR-007 | US2 | The package keeps the non-goals tight and points later work at the route and test files. |
| FR-006, FR-008 | Setup and Polish | The package includes verification anchors and stays clear of runtime refactor scope. |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is a read-only validation with no dependency on incomplete work
- **[Story]**: Which user story the task belongs to (`US1`, `US2`)
- Every task description includes an exact file path or command

## Phase 1: Setup (Shared Docs Baseline)

**Purpose**: Confirm the source pages, route examples, and package shape before drafting the final copy.

- [ ] T001 Confirm `docs/wiki/API Refactor Roadmap.md` and `docs/wiki/API Boundary Architecture.md` already describe R3 and the durable public error section
- [ ] T002 [P] Confirm `apps/api/app/auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, and `apps/api/app/routes_archives.py` provide the live examples the package will cite
- [ ] T003 [P] Confirm `specs/005-public-api-error-mapping-convention/` follows the existing `spec.md`, `plan.md`, `tasks.md` package shape

---

## Phase 2: Drafting (Core Docs)

**Purpose**: Write the spec and plan so the convention, non-goals, and later implementation path are explicit.

**CRITICAL**: No polish task should start until the core docs are written.

- [ ] T004 Draft `specs/005-public-api-error-mapping-convention/spec.md` with the current route examples, the public status-code convention, the non-goals, and the later implementation path
- [ ] T005 [P] Draft `specs/005-public-api-error-mapping-convention/plan.md` with the docs-only scope, source list, verification strategy, and success definition

**Checkpoint**: The docs package states the convention clearly and keeps runtime change out of scope.

---

## Phase 3: Task Bundle and Note

**Purpose**: Close the package with the task list and the short notepad note the user asked for.

- [ ] T006 Write `specs/005-public-api-error-mapping-convention/tasks.md` with docs-only traceability and verification anchors
- [ ] T007 [P] Append a brief note to `.omo/notepads/backend-phase-01-api-boundary/learnings.md` that records the missing-path check and the `specs/005-public-api-error-mapping-convention/` naming decision

**Checkpoint**: The package has the full Spec Kit trio and the research note is recorded.

---

## Phase 4: Polish & Verification

**Purpose**: Confirm the docs package is clean and stays docs-only.

- [ ] T008 Run a placeholder scan across `specs/005-public-api-error-mapping-convention` and any touched wiki or notepad files, then confirm no unresolved placeholders remain
- [ ] T009 Run `git diff -- specs/005-public-api-error-mapping-convention docs/wiki .omo/notepads/backend-phase-01-api-boundary` and confirm the change set stays docs-only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, can start immediately
- **Drafting (Phase 2)**: Depends on Setup completion
- **Task Bundle and Note (Phase 3)**: Depends on Drafting completion
- **Polish & Verification (Phase 4)**: Depends on the package being drafted

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup because they are read-only checks against different sources
- T005 and T007 can run in parallel once the spec draft is stable because they touch different files
- T008 and T009 can run in parallel during Polish because they are verification only

---

## Implementation Strategy

### Minimum Deliverable

1. Confirm the current error-mapping sources.
2. Draft the spec and plan.
3. Record the note and finalize the task list.
4. Run the placeholder scan and docs-only diff check.

### Incremental Delivery

1. Write the spec first so the convention is visible.
2. Add the plan so the scope and verification are explicit.
3. Add the tasks so the package is complete and reviewable.
4. Finish with the notepad note and verification.

---

## Notes

- Keep the package narrow. Do not widen it into a runtime refactor.
- Use the current route behavior as the source of truth, then let later work harden it in code.
- Add a wiki pointer only if the existing spine does not already make the path obvious.
