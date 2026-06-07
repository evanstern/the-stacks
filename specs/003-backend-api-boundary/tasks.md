# Tasks: API Boundary Architecture

**Input**: Design documents from `/specs/003-backend-api-boundary/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `.specify/memory/constitution.md`, and the existing API review evidence in `specs/002-api-architecture-review/api-architecture-review.md`

**Tests**: No automated code tests are generated because this feature is documentation-only. Validation uses wiki review, frontmatter timestamp checks, placeholder scans, and git diff review.

**Organization**: Tasks are grouped by user story so each documentation increment can be completed and reviewed independently.

## Requirement Traceability

| Requirement | Story | Validation target |
|-------------|-------|-------------------|
| FR-001 through FR-006 | US1 | `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` becomes the durable API boundary note and covers route ownership, service ownership, dependency injection, public error mapping, response contracts, and test seams. |
| FR-007 and FR-011 | US2 | `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` includes the wiki preflight and postflight rule plus mismatch recording guidance for future backend refactor phases. |
| FR-008 through FR-010 | US3 | `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md` and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md` link or align to the new API boundary page and refresh `updated` frontmatter on changed wiki pages. |
| FR-012 through FR-014 | Setup and Polish | Scope checks, diff review, and append-only note keeping ensure the feature stays documentation-only and remains off deploy-only `main`. |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is a read-only validation with no dependency on incomplete tasks
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Every task description includes an exact file path or command

## Phase 1: Setup (Shared Documentation Baseline)

**Purpose**: Confirm the feature artifacts, governance constraints, and source evidence before story work begins.

- [X] T001 Confirm `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/plan.md` and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/.specify/memory/constitution.md` both keep this feature documentation-only and forbid runtime API behavior changes
- [X] T002 [P] Read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Chat Sessions Architecture.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/ETL Architecture.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/RAG Retrieval Architecture.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Corpus Management Architecture.md`, and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Queue Architecture.md` to capture the current architecture spine and link targets
- [X] T003 [P] Read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/002-api-architecture-review/api-architecture-review.md` so the durable wiki page can reuse the distilled route, service, dependency, error, response, and test seam evidence
- [X] T004 [P] Scan `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/spec.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/research.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/data-model.md`, and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/quickstart.md` for unresolved placeholders or template markers before any wiki edits begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the durable API boundary page shape and source map that every user story depends on.

**CRITICAL**: No user story task should start until this phase is complete.

- [X] T005 Create `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` with frontmatter, title, summary, and section headings for route ownership, service ownership, dependency injection, public error mapping, response contracts, test seams, wiki preflight, and wiki postflight
- [X] T006 [P] Add a short source-links block to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` that points readers back to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md`, and the supporting architecture pages used as API boundary context
- [X] T007 [P] Add the durable-contract statement to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` so the page clearly says planning artifacts are evidence only and the wiki spine is the lasting source of truth

**Checkpoint**: The API boundary page exists in skeleton form and can be filled with the story content below.

---

## Phase 3: User Story 1 - Maintainer reads one API boundary contract before refactoring (Priority: P1) MVP

**Goal**: A maintainer can open one durable wiki page and understand route ownership, service ownership, dependency injection, error mapping, response contracts, and test seams without chasing planning chat history.

**Independent Test**: Read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` together with `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md` and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md`; confirm the page names the route boundary, service seam, dependency seam, public error mapping, response contract, and test seam rules in plain language.

### Implementation for User Story 1

- [X] T008 [P] [US1] Add the route-versus-service ownership section to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` using `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Chat Sessions Architecture.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/ETL Architecture.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/RAG Retrieval Architecture.md`, and the current route and service seams from the existing API review as concrete references
- [X] T009 [P] [US1] Add the dependency injection conventions section to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` covering `Depends(...)`, `Annotated[..., Depends(...)]`, and named override seams for DB sessions, settings, auth/session state, embeddings, Qdrant, retrieval, chat, and graph collaborators
- [X] T010 [P] [US1] Add the public error mapping, response contract, and test seam sections to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md`, including terse public-safe `HTTPException` handling, `response_model` and schema ownership, `TestClient`, and `app.dependency_overrides`
- [X] T011 [US1] Refresh the `updated` frontmatter in `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` after the core contract sections are complete

**Checkpoint**: User Story 1 is independently reviewable as the MVP documentation increment.

---

## Phase 4: User Story 2 - Refactor phases evaluate wiki alignment before and after changes (Priority: P1)

**Goal**: Future backend refactor phases have a repeatable wiki preflight and postflight rule that keeps code and architecture docs synchronized.

**Independent Test**: Read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` and confirm it tells future implementers which wiki pages to read before changes, which pages to re-read after changes, and how to record any mismatch.

### Implementation for User Story 2

- [X] T012 [P] [US2] Add the wiki preflight rule to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` requiring future backend refactor phases to read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md`, and any phase-relevant layer pages before code changes
- [X] T013 [P] [US2] Add the wiki postflight rule to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` requiring the same pages to be re-read after implementation, with `updated` frontmatter refreshed on any changed wiki pages
- [X] T014 [US2] Add the mismatch-handling and verification-recording guidance to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` so future phases can note whether a code/wiki mismatch was fixed, deferred, or intentionally left unchanged
- [X] T015 [US2] Refresh the `updated` frontmatter in `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` after the preflight and postflight rule is finalized

**Checkpoint**: User Story 2 is independently reviewable as the wiki synchronization rule set for later backend work.

---

## Phase 5: User Story 3 - Existing layer boundaries point to the new API-specific contract (Priority: P2)

**Goal**: A reader who starts from the wiki spine can discover the new API contract, and `Layer Boundaries.md` can stay concise by linking instead of duplicating the full API guidance.

**Independent Test**: Start at `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md`, follow the reading order to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md`, then check `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md` to confirm it links or aligns without repeating the full contract.

### Implementation for User Story 3

- [X] T016 [P] [US3] Update `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md` so the architecture reading order links readers to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md`
- [X] T017 [P] [US3] Update `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md` only enough to link or align with `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` without duplicating the full API contract
- [X] T018 [P] [US3] Refresh the `updated` frontmatter in `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md` after the reading-order change
- [X] T019 [P] [US3] Refresh the `updated` frontmatter in `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md` after the link or alignment change
- [X] T020 [US3] Re-read `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md`, and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` to confirm the new page is discoverable from the durable wiki spine and the layer map stays concise

**Checkpoint**: User Story 3 is independently reviewable once the wiki spine points to the API boundary note and the layer map remains concise.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the generated wiki bundle, preserve governance constraints, and record any durable follow-up notes.

- [X] T021 [P] Append an implementation note to `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/.omo/notepads/backend-phase-01-api-boundary/learnings.md` summarizing the final wiki paths and any mismatch decisions, using append-only updates only
- [X] T022 [P] Run `rg -n "placeholder|template marker|unresolved marker" /home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki` and capture the result in the feature notes if anything remains unresolved
- [X] T023 [P] Compare `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` against `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/spec.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/research.md`, `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/data-model.md`, and `/home/coda/projects/the-stacks/backend-phase-01-api-boundary/specs/003-backend-api-boundary/quickstart.md` to confirm the durable contract language matches the feature bundle
- [X] T024 [P] Run `git diff -- /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Home.md /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/Layer Boundaries.md /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md` and confirm the diff stays documentation-only with no runtime API changes, migrations, worker changes, or frontend changes
- [X] T025 [US3] Confirm the final `updated` frontmatter values and wiki links satisfy FR-008 through FR-010

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion, MVP scope
- **User Story 2 (Phase 4)**: Depends on User Story 1 because it extends the same durable wiki page with the wiki preflight and postflight rule
- **User Story 3 (Phase 5)**: Depends on User Story 2 because it links the finalized contract into the durable wiki spine
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational, no dependency on other stories
- **User Story 2 (P1)**: Starts after User Story 1, no dependency on User Story 3
- **User Story 3 (P2)**: Starts after User Story 2, no dependency on new runtime work

### Parallel Opportunities

- T002, T003, and T004 can run in parallel during Setup because they are read-only checks against different source files
- T006 and T007 can run in parallel after T005 because they fill different parts of the new wiki page skeleton
- T008, T009, and T010 can run in parallel for User Story 1 because each adds a different contract section to the same page
- T012 and T013 can run in parallel for User Story 2 because they add the preflight and postflight rule separately
- T016, T017, T018, and T019 can run in parallel for User Story 3 because they touch different wiki files or distinct frontmatter updates
- T021, T022, T023, and T024 can run in parallel during Polish, subject to whether the note append and diff review are being coordinated in the same session

---

## Parallel Example: User Story 1

```bash
# Independent wiki content tasks
Task: "Add the route-versus-service ownership section to /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md using the current API review and related wiki pages"
Task: "Add the dependency injection conventions section to /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md"
Task: "Add the public error mapping, response contract, and test seam sections to /home/coda/projects/the-stacks/backend-phase-01-api-boundary/docs/wiki/API Boundary Architecture.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the MVP by checking the new API boundary page against `docs/wiki/Home.md` and `docs/wiki/Layer Boundaries.md`

### Incremental Delivery

1. Complete Setup and Foundational tasks so the documentation constraints and page shape are clear
2. Complete US1 to lock the durable API boundary contract language
3. Complete US2 to lock the wiki preflight and postflight rule for later backend refactors
4. Complete US3 to make the new page discoverable from the wiki spine
5. Complete Polish tasks to validate placeholders, frontmatter updates, diff scope, and append-only notes

### Review-Only Guardrail

Do not modify runtime API code, database migrations, worker internals, frontend files, or external service behavior while executing these tasks. If a mismatch is found, document the durable wiki fix rather than inventing runtime work.

---

## Notes

- This is a documentation-only feature, so the durable contract lives in `docs/wiki/` and not in planning artifacts
- `docs/wiki/Home.md` stays the entry point, while `docs/wiki/Layer Boundaries.md` remains concise and points readers at the API-specific contract
- Any changed wiki page must refresh `updated` frontmatter before the feature is considered complete
- No P3 story exists in this spec, so do not invent additional scope or runtime work
