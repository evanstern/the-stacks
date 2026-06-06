---
description: "Tasks for live DB-backed queue claim/status documentation"
---

# Tasks: Live DB-Backed Queue Claim/Status Handling

**Input**: Design documents from `/specs/001-live-db-backed-queue/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`; no `contracts/` directory is present or needed for this documentation-only feature.

**Tests**: Automated tests are not requested by the feature specification. Validation tasks use document review, code/wiki cross-checks, and the quickstart verification path.

**Organization**: Tasks are grouped by user story so each documentation increment can be completed and reviewed independently.

## Requirement Traceability

| Requirement | Story | Validation target |
|-------------|-------|-------------------|
| FR-001 | US1 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` describes the current queue as live DB-backed claim/status handling rather than a standalone brokered queue. |
| FR-002 | US2 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` and `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md` explain ordinary DB rows and status transitions as the source of queue state. |
| FR-003 | US2 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` keeps ETL, chat, and corpus ownership outside the queue boundary. |
| FR-004 | US2 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md` covers the live claim-and-status flow for operator visibility. |
| FR-005 | US2 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` states the operator-facing value without implementation-heavy detail. |
| FR-006 | US3 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md`, `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/plan.md`, and `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/quickstart.md` exclude broker redesign, retry, cancel, admin dashboards, and broader admin workflows. |
| FR-007 | US3 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` excludes ETL, chat, and corpus ownership transfer. |
| FR-008 | US1 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` assumes wiki pages and live code remain the current boundary source of truth. |
| FR-009 | US3 | `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` remains a concise durable planning reference. |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is a read-only validation with no dependency on incomplete tasks
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- All task descriptions include exact file paths or commands

## Phase 1: Setup (Shared Documentation Baseline)

**Purpose**: Confirm the feature artifact set and live queue reference files before story work begins.

- [X] T001 Confirm `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/plan.md` declares this feature as documentation-only and excludes brokered queue redesign
- [X] T002 [P] Confirm `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/research.md` names the live code seams in `main/apps/api/app/ingestion.py`, `main/apps/worker/worker.py`, `main/apps/api/app/routes_uploads.py`, and `main/apps/api/app/routes_ingestion.py`
- [X] T003 [P] Confirm `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md` covers `UploadBatch`, `Upload`, `IngestionJob`, `IngestionEvent`, and queue claim state
- [X] T004 [P] Confirm `/home/coda/projects/the-stacks/main/docs/wiki/Layer Boundaries.md` and `/home/coda/projects/the-stacks/main/docs/wiki/Queue Architecture.md` remain the durable wiki references for the current DB-backed claim/status boundary

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the documentation constraints that every user story must preserve.

**CRITICAL**: No user story task should start until this phase is complete.

- [X] T005 Create a working notes checklist in `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/tasks.md` that maps FR-001 through FR-009 to US1, US2, or US3
- [X] T006 Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` contains no unresolved clarification markers such as `[NEEDS CLARIFICATION]`, `TODO`, or `TBD`
- [X] T007 Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` keeps ETL, chat, corpus ownership changes, retry controls, cancel controls, broker redesign, admin dashboards, and broader admin workflows out of scope
- [X] T008 Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/quickstart.md` points readers to the spec bundle and the queue wiki pages without adding implementation-heavy procedure

**Checkpoint**: Documentation baseline is ready; user story documentation can now proceed.

---

## Phase 3: User Story 1 - Operator can understand the live queue boundary (Priority: P1) MVP

**Goal**: A maintainer can read the feature spec and understand that the current queue is DB-backed claim/status handling, not a standalone broker system.

**Independent Test**: Compare `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` with `/home/coda/projects/the-stacks/main/docs/wiki/Layer Boundaries.md` and `/home/coda/projects/the-stacks/main/docs/wiki/Queue Architecture.md`; confirm the spec describes the live DB-backed flow and rejects broker semantics.

### Implementation for User Story 1

- [X] T009 [P] [US1] Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` states the queue is live DB-backed claim/status handling in the User Story 1 description and FR-001
- [X] T010 [P] [US1] Verify `/home/coda/projects/the-stacks/main/docs/wiki/Queue Architecture.md` says `ingestion.py` claims queued jobs with `FOR UPDATE SKIP LOCKED` and no standalone broker exists
- [X] T011 [US1] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` if needed so Acceptance Scenario 1 identifies DB rows and status fields as the live mechanism
- [X] T012 [US1] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` if needed so Acceptance Scenario 2 explicitly treats future broker semantics as out of scope
- [X] T013 [US1] Record the US1 review result in `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/tasks.md` by checking that SC-001 can be satisfied without reading implementation code

**Checkpoint**: User Story 1 is independently reviewable as the MVP documentation increment.

---

## Phase 4: User Story 2 - Operator can see how status moves through the boundary (Priority: P1)

**Goal**: A maintainer can identify the source of truth for claim and status state, plus the surfaces that read or update it.

**Independent Test**: Read `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` and `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md`; confirm they explain queued job rows, worker claims, status transitions, batch aggregation, and job events without moving ETL/chat/corpus ownership.

### Implementation for User Story 2

- [X] T014 [P] [US2] Verify `/home/coda/projects/the-stacks/main/apps/api/app/models.py` defines `UploadBatch`, `Upload`, `IngestionJob`, and `IngestionEvent` as the persisted status entities referenced by `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md`
- [X] T015 [P] [US2] Verify `/home/coda/projects/the-stacks/main/apps/api/app/ingestion.py` contains `claim_next_job` and `claim_next_awaiting_embedding_job` row-locking status transitions referenced by `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/research.md`
- [X] T016 [P] [US2] Verify `/home/coda/projects/the-stacks/main/apps/api/app/routes_uploads.py` derives batch status from child `IngestionJob.status` values for operator visibility
- [X] T017 [P] [US2] Verify `/home/coda/projects/the-stacks/main/apps/api/app/routes_ingestion.py` exposes job status and event history as read paths for operator visibility
- [X] T018 [US2] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/data-model.md` if needed so the status flow covers queued jobs, worker claims, processing, awaiting embedding, completed or failed terminal states, batch status derivation, and events
- [X] T019 [US2] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` if needed so FR-002, FR-003, FR-004, and FR-005 are plain-language statements of the queue status boundary

**Checkpoint**: User Story 2 is independently reviewable against the current model, worker, upload, and ingestion route seams.

---

## Phase 5: User Story 3 - Planning can stay constrained to current reality (Priority: P2)

**Goal**: Future planners can use the spec bundle to avoid scope drift into retries, cancellation, admin dashboards, broker redesign, or ownership changes.

**Independent Test**: Review `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md`, `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/plan.md`, and `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/quickstart.md`; confirm each artifact preserves the same explicit out-of-scope list.

### Implementation for User Story 3

- [X] T020 [P] [US3] Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` explicitly excludes brokered queue redesign, retry controls, cancel controls, admin dashboards, broader admin workflows, and ETL/chat/corpus ownership changes in FR-006 and FR-007
- [X] T021 [P] [US3] Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/plan.md` excludes broker semantics, retry or cancel controls, admin dashboards, and ETL/chat/corpus ownership changes in the Summary, Constraints, and Structure Decision sections
- [X] T022 [P] [US3] Verify `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/quickstart.md` lists the same not-to-do boundaries under `What not to do`
- [X] T023 [US3] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` if needed so the Edge Cases and Assumptions sections reject future queue redesign work as separate features
- [X] T024 [US3] Update `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/research.md` if needed so the Open caveat says brokered queue work needs its own spec and wiki update

**Checkpoint**: User Story 3 is independently reviewable as a scope-control increment.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the generated documentation bundle and preserve governance constraints.

- [X] T025 [P] Run `bash .specify/scripts/bash/setup-tasks.sh --json` from `/home/coda/projects/the-stacks` and confirm it resolves `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue`
- [X] T026 [P] Run `rg -n "broker|retry|cancel|admin|ETL|chat|corpus|claim/status|DB-backed|database-backed" specs/001-live-db-backed-queue main/docs/wiki` from `/home/coda/projects/the-stacks` and confirm the scope language is consistent
- [X] T027 [P] Run `rg -n "NEEDS CLARIFICATION|TODO|TBD|standalone broker|brokered queue design" specs/001-live-db-backed-queue --glob '!tasks.md'` from `/home/coda/projects/the-stacks` and confirm only intentional out-of-scope broker language appears
- [X] T028 [P] Run `make test` from `/home/coda/projects/the-stacks/main` only if any implementation code under `/home/coda/projects/the-stacks/main/apps/` was changed while completing this documentation feature
- [X] T029 Validate `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/tasks.md` so every task follows `- [ ] T### [P?] [US?] Description with file path or command`
- [X] T030 Confirm `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/tasks.md` includes a wiki-impact decision: no wiki update is required unless the live queue boundary changed during task execution

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational; no dependency on other stories, but should preserve US1 terminology
- **User Story 3 (P2)**: Can start after Foundational; no dependency on other stories, but should preserve the same out-of-scope list

### Within Each User Story

- Read-only verification tasks marked [P] can run before edits in the same story
- Edit tasks should run after the story's read-only verification tasks
- Story checkpoint review should happen before moving to polish

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during Setup
- T009 and T010 can run in parallel for US1
- T014, T015, T016, and T017 can run in parallel for US2
- T020, T021, and T022 can run in parallel for US3
- T025, T026, T027, and T028 can run in parallel during Polish, subject to whether code changed
- After Phase 2, US1, US2, and US3 can be assigned to different reviewers because they primarily touch different validation concerns

---

## Parallel Example: User Story 2

```bash
# Run read-only validation in parallel before any documentation edits:
Task: "Verify models in /home/coda/projects/the-stacks/main/apps/api/app/models.py match data-model.md"
Task: "Verify claim functions in /home/coda/projects/the-stacks/main/apps/api/app/ingestion.py match research.md"
Task: "Verify batch aggregation in /home/coda/projects/the-stacks/main/apps/api/app/routes_uploads.py matches data-model.md"
Task: "Verify job status/event read paths in /home/coda/projects/the-stacks/main/apps/api/app/routes_ingestion.py match research.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the MVP by checking the spec against the queue wiki pages

### Incremental Delivery

1. Complete Setup and Foundational tasks so the documentation constraints are clear
2. Complete US1 to lock the current DB-backed queue boundary language
3. Complete US2 to validate status movement and operator-visible read paths
4. Complete US3 to lock explicit exclusions and prevent future scope drift
5. Complete Polish tasks to validate formatting, quickstart consistency, and governance notes

### Parallel Team Strategy

With multiple reviewers:

1. One reviewer completes Setup and Foundational checks
2. Then assign US1 to a queue-boundary reviewer, US2 to a backend-seams reviewer, and US3 to a scope-control reviewer
3. Reconcile any edits in `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` before the final polish validation

---

## Notes

- This is a documentation-only feature; do not add runtime queue code, migrations, API contracts, worker behavior, UI, retry controls, cancel controls, admin dashboards, or broker infrastructure while completing these tasks.
- The durable architecture source remains `/home/coda/projects/the-stacks/main/docs/wiki/Layer Boundaries.md` and `/home/coda/projects/the-stacks/main/docs/wiki/Queue Architecture.md` unless the live boundary changes.
- If a task reveals a mismatch between spec artifacts and live code or wiki pages, update the spec bundle first and only update wiki pages when the durable architecture boundary itself has changed.
- US1 review result: SC-001 is satisfied by `/home/coda/projects/the-stacks/specs/001-live-db-backed-queue/spec.md` alone. The User Story 1 text, acceptance scenarios, FR-001, and assumptions identify the current queue as DB-backed claim/status handling and reject standalone broker semantics without requiring implementation-code reading.
- Wiki-impact decision: no wiki update was required for this implementation pass because the live queue boundary did not change; the tasks only validated and recorded the existing DB-backed claim/status boundary.
