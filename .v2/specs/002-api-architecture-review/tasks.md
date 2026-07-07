# Tasks: API Layer Architecture Review

**Input**: Design documents from `specs/002-api-architecture-review/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/review-report.md`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: No automated code tests are generated because this feature is a review/design artifact and does not change runtime API behavior. Validation is performed through artifact checks and the review contract.

**Organization**: Tasks are grouped by user story to enable independent execution and verification of each review increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it writes a different file or is read-only evidence gathering
- **[Story]**: Maps task to user story from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Review Infrastructure)

**Purpose**: Establish the report and evidence artifacts without touching runtime API code.

- [X] T001 Create the review report skeleton with all required contract sections in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T002 Create the evidence log with source categories and command slots in `specs/002-api-architecture-review/evidence.md`
- [X] T003 [P] Record the review-only boundary and non-goals from `specs/002-api-architecture-review/plan.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T004 [P] Record the constitution constraints and wiki-impact requirement from `.specify/memory/constitution.md` in `specs/002-api-architecture-review/evidence.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Collect the evidence inventory and wiki direction that every user story depends on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Run `rg -n "architecture|boundary|contract|decision|owns|does not own|roadmap" docs/wiki` and save the command/output summary in `specs/002-api-architecture-review/evidence.md`
- [X] T006 Run `rg -n "APIRouter|include_router|response_model|Depends\(|HTTPException|^class |^def " apps/api/app` and save the command/output summary in `specs/002-api-architecture-review/evidence.md`
- [X] T007 Run `rg -n "dependency_overrides|get_db|response_model|RetrievalService|answer_session_message|HTTPException" apps/api/tests` and save the command/output summary in `specs/002-api-architecture-review/evidence.md`
- [X] T008 Summarize the wiki reading order and applicable pages from `docs/wiki/Home.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T009 Summarize the layer ownership constraints from `docs/wiki/Layer Boundaries.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T010 Cross-check the evidence inventory against `specs/002-api-architecture-review/contracts/review-report.md` and record missing evidence items in `specs/002-api-architecture-review/evidence.md`

**Checkpoint**: Evidence inventory and wiki direction are available for all user stories.

---

## Phase 3: User Story 1 - Wiki-Grounded API Architecture Review (Priority: P1) MVP

**Goal**: Produce a wiki-grounded API architecture review that maps the current API layer, route boundaries, service seams, schemas, persistence models, and cross-layer dependencies with explicit file references.

**Independent Test**: Compare `specs/002-api-architecture-review/api-architecture-review.md` against `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, API route/service modules, and `contracts/review-report.md`; every architectural claim must cite wiki, code, or test evidence.

### Implementation for User Story 1

- [X] T011 [P] [US1] Summarize ETL upload/job API direction from `docs/wiki/ETL Architecture.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T012 [P] [US1] Summarize ETL plugin and LangGraph boundary decisions from `docs/wiki/ETL Plugin Contracts.md` and `docs/wiki/LangGraph ETL Decision.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T013 [P] [US1] Summarize retrieval scope and trace direction from `docs/wiki/RAG Retrieval Architecture.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T014 [P] [US1] Summarize corpus, chat, and queue API-relevant constraints from `docs/wiki/Corpus Management Architecture.md`, `docs/wiki/Chat Sessions Architecture.md`, and `docs/wiki/Queue Architecture.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T015 [US1] Map FastAPI app composition, CORS, health, and mounted routers from `apps/api/app/main.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T016 [P] [US1] Map auth, session, upload, ingestion, records, and archive route prefixes, dependencies, response models, and major error shapes from `apps/api/app/routes_auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, and `apps/api/app/routes_archives.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T017 [P] [US1] Map request and response contract models from `apps/api/app/schemas.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T018 [P] [US1] Map persistence entities exposed by API responses from `apps/api/app/models.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T019 [P] [US1] Map service seams for chat, retrieval, ingestion, corpus, version lifecycle, embeddings, and Qdrant from `apps/api/app/chat_session_service.py`, `apps/api/app/retrieval_service.py`, `apps/api/app/ingestion.py`, `apps/api/app/corpus_seed.py`, `apps/api/app/corpus_reset.py`, `apps/api/app/version_lifecycle.py`, `apps/api/app/embeddings.py`, and `apps/api/app/qdrant_index.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T020 [US1] Compare the API surface map against the wiki direction and record alignment/mismatch notes in `specs/002-api-architecture-review/api-architecture-review.md`

**Checkpoint**: User Story 1 is independently complete when the report contains the required evidence inventory, wiki direction summary, API surface map, and service/pattern map.

---

## Phase 4: User Story 2 - Separate Alignment Findings From Suggestions (Priority: P1)

**Goal**: Classify observations as alignment, risk, inconsistency, or improvement so the review informs planning without silently changing runtime behavior.

**Independent Test**: Every finding in `api-architecture-review.md` has category, severity, evidence references, affected files/seams, impact, and a scoped next step that does not require immediate code changes in this feature.

### Implementation for User Story 2

- [X] T021 [US2] Create the findings table using the categories and fields from `specs/002-api-architecture-review/contracts/review-report.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T022 [P] [US2] Assess route-thinness and dependency injection patterns from `apps/api/app/routes_*.py` and record alignment/risk findings in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T023 [P] [US2] Assess response-model and schema boundary patterns from `apps/api/app/schemas.py` and `apps/api/tests/test_contracts.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T024 [P] [US2] Assess HTTP error mapping and public-safe failure handling from `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, and `apps/api/tests/test_uploads.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T025 [P] [US2] Assess retrieval, chat, corpus, and queue ownership boundaries from `apps/api/app/retrieval_service.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/version_lifecycle.py`, and `docs/wiki/Layer Boundaries.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T026 [P] [US2] Assess dependency override and testability seams from `apps/api/tests/test_auth.py`, `apps/api/tests/test_sessions.py`, `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_retrieval_service.py` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T027 [US2] Convert each finding into a scoped recommendation type from `contracts/review-report.md` in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T028 [US2] Record non-goals and deferred work for frontend, migrations, route changes, worker internals, and broad refactors in `specs/002-api-architecture-review/api-architecture-review.md`

**Checkpoint**: User Story 2 is independently complete when findings and recommendations are categorically separated and no recommendation requires immediate runtime changes.

---

## Phase 5: User Story 3 - Bounded Recommendation Backlog (Priority: P2)

**Goal**: Group recommendations by priority and blast radius so future planning can select bounded follow-up work without reopening the entire API architecture.

**Independent Test**: A future planner can select any recommendation in `api-architecture-review.md` and see priority, affected files, benefit, risk if deferred, verification anchor, wiki-impact decision, and suggested follow-up type.

### Implementation for User Story 3

- [X] T029 [US3] Create the recommendation backlog table with priority, blast radius, follow-up type, benefit, deferred risk, verification anchor, and wiki-impact columns in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T030 [P] [US3] Group documentation-only recommendations and wiki-impact decisions in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T031 [P] [US3] Group refactor-only recommendations by API route/service seam and affected files in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T032 [P] [US3] Group contract/schema recommendations with affected Pydantic models, route responses, and API tests in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T033 [P] [US3] Group test coverage recommendations with specific `apps/api/tests/` targets in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T034 [US3] Identify which recommendations should become future Spec Kit features or OMO plans in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T035 [US3] Add an implementation strategy section for selecting future bounded follow-up work in `specs/002-api-architecture-review/api-architecture-review.md`

**Checkpoint**: User Story 3 is independently complete when the backlog can seed future bounded planning without new architecture discovery.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the generated review report against its contract and preserve audit evidence.

- [X] T036 Run `rg -n "NEEDS CLARIFICATION|TBD|\[FEATURE|\[###" specs/002-api-architecture-review --glob '!quickstart.md' --glob '!tasks.md' --glob '!evidence.md'` and record the result in `specs/002-api-architecture-review/evidence.md`
- [X] T037 Run `rg -n "category:|severity:|evidence|affected|impact|follow-up type|wiki-impact" specs/002-api-architecture-review/api-architecture-review.md` and record the result in `specs/002-api-architecture-review/evidence.md`
- [X] T038 Compare `specs/002-api-architecture-review/api-architecture-review.md` to `specs/002-api-architecture-review/contracts/review-report.md` and record pass/fail notes in `specs/002-api-architecture-review/evidence.md`
- [X] T039 Record the final wiki-impact decision for the review in `specs/002-api-architecture-review/api-architecture-review.md`
- [X] T040 Run `git diff -- specs/002-api-architecture-review` and summarize the artifact-only changes in `specs/002-api-architecture-review/evidence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because findings need the evidence inventory and maps.
- **User Story 3 (Phase 5)**: Depends on User Story 2 because backlog items come from classified findings.
- **Polish (Phase 6)**: Depends on all selected user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational; no dependency on US2 or US3.
- **User Story 2 (P1)**: Starts after US1; depends on completed evidence maps.
- **User Story 3 (P2)**: Starts after US2; depends on classified findings and scoped recommendations.

### Parallel Opportunities

- T003 and T004 can run in parallel after T001 and T002 are created.
- T011 through T014 can run in parallel because they summarize different wiki pages into the same report section after the skeleton exists.
- T016 through T019 can run in parallel if coordinated to avoid edit conflicts, because each maps a different API evidence category.
- T022 through T026 can run in parallel because each assesses a distinct pattern category.
- T030 through T033 can run in parallel because each groups a different recommendation type.

---

## Parallel Example: User Story 1

```bash
# Independent wiki summary tasks
Task: "Summarize ETL upload/job API direction from docs/wiki/ETL Architecture.md in specs/002-api-architecture-review/api-architecture-review.md"
Task: "Summarize retrieval scope and trace direction from docs/wiki/RAG Retrieval Architecture.md in specs/002-api-architecture-review/api-architecture-review.md"
Task: "Summarize corpus/chat/queue constraints from docs/wiki/* Architecture.md in specs/002-api-architecture-review/api-architecture-review.md"

# Independent API map tasks
Task: "Map route prefixes and response models from apps/api/app/routes_*.py in specs/002-api-architecture-review/api-architecture-review.md"
Task: "Map service seams from apps/api/app/*service.py and related adapters in specs/002-api-architecture-review/api-architecture-review.md"
```

## Parallel Example: User Story 2

```bash
Task: "Assess route-thinness and dependency injection patterns from apps/api/app/routes_*.py in specs/002-api-architecture-review/api-architecture-review.md"
Task: "Assess response-model and schema boundary patterns from apps/api/app/schemas.py and apps/api/tests/test_contracts.py in specs/002-api-architecture-review/api-architecture-review.md"
Task: "Assess dependency override and testability seams from apps/api/tests in specs/002-api-architecture-review/api-architecture-review.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup artifacts.
2. Complete Phase 2 evidence inventory.
3. Complete Phase 3 User Story 1 maps and wiki-grounded summary.
4. Stop and validate the report against the User Story 1 independent test.

### Incremental Delivery

1. Deliver US1 to establish the evidence-backed architecture map.
2. Deliver US2 to classify findings and recommendations.
3. Deliver US3 to turn recommendations into a bounded future-work backlog.
4. Complete Phase 6 validation and evidence logging.

### Review-Only Guardrail

Do not modify `apps/api/app`, `apps/api/tests`, database migrations, frontend files, or runtime behavior while executing these tasks. Any recommendation requiring code changes must become a separate future feature, task list, or OMO plan.

---

## Notes

- [P] tasks use different source evidence categories or distinct report sections and can be parallelized with coordination.
- [Story] labels map to User Story 1, User Story 2, and User Story 3 in `spec.md`.
- The final deliverable is `specs/002-api-architecture-review/api-architecture-review.md` plus evidence in `specs/002-api-architecture-review/evidence.md`.
- The existing `specs/001-live-db-backed-queue/` feature is out of scope except as contrast for why this API review is separate.
