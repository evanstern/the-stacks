# Feature Specification: API Layer Architecture Review

**Feature Branch**: `[002-api-architecture-review]`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "start a reciew of the architexture, decisions, the design and pattern hsage, the apu layer only. full sweep. ingest tge wiki and align our direction based on that data and make suggestions for improvements."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintainer gets a wiki-grounded API architecture review (Priority: P1)

As a maintainer, I need a full API-layer-only architecture review that starts from the current wiki and code seams so the recommendations reflect the system that exists today.

**Why this priority**: The review is only valuable if it is grounded in the durable architecture spine. A generic FastAPI review would miss the project-specific ETL, retrieval, corpus, chat, and queue ownership boundaries.

**Independent Test**: A reviewer can compare the output against `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, the API route/service modules, and the review contract to confirm that every finding cites current project evidence.

**Acceptance Scenarios**:

1. **Given** the current wiki and API code, **When** the review is prepared, **Then** it identifies the API layer seams, route boundaries, service boundaries, schemas, persistence models, and cross-layer dependencies using explicit file references.
2. **Given** a recommendation in the review, **When** a maintainer checks its source, **Then** the recommendation traces back to wiki direction, API code, or tests rather than unsupported preference.

---

### User Story 2 - Maintainer can separate alignment findings from improvement suggestions (Priority: P1)

As a maintainer, I need the review to distinguish current-state alignment, risks, inconsistencies, and improvement opportunities so follow-up work can be scoped without accidentally changing runtime behavior.

**Why this priority**: The requested output is a review and direction-setting artifact. It should inform planning, not silently implement architectural changes.

**Independent Test**: A reader can classify each finding as aligned, risk, inconsistency, or suggestion, and can see whether it affects routes, service seams, schemas/contracts, persistence, tests, or wiki documentation.

**Acceptance Scenarios**:

1. **Given** mixed API patterns such as thin routes, route-local helpers, service classes, and direct persistence access, **When** the review describes them, **Then** it states which patterns are intentional, which are legacy/current-state compromises, and which deserve follow-up planning.
2. **Given** a suggested improvement, **When** the reader evaluates scope, **Then** the review states whether the item is documentation-only, refactor-only, contract work, test coverage, or a future implementation feature.

---

### User Story 3 - Future planning can use a bounded recommendation backlog (Priority: P2)

As a planner, I need recommendations grouped by priority and blast radius so future Spec Kit tasks can be created without reopening the entire API architecture every time.

**Why this priority**: The review should reduce future ambiguity. Recommendations that are not bounded become broad refactor prompts and risk crossing ETL, retrieval, chat, corpus, or queue ownership lines.

**Independent Test**: A future planner can select one recommendation and turn it into a separate feature with clear scope, owners, verification commands, and wiki-impact expectations.

**Acceptance Scenarios**:

1. **Given** a high-priority API-layer risk, **When** it appears in the review, **Then** it includes affected files, expected benefit, risk if deferred, and the recommended next artifact or task.
2. **Given** a low-priority cleanup, **When** it appears in the review, **Then** it is labeled as non-blocking and does not obscure correctness or boundary risks.

---

### Edge Cases

- What if a finding touches frontend behavior? The review may mention the route/server API surface, but frontend UI, CSS, and component work are out of scope.
- What if a finding touches ETL, retrieval, corpus, chat, or queue internals? The review must evaluate the API-layer seam and ownership boundary only; deeper layer changes require separate specs.
- What if the wiki and code disagree? The review must record the mismatch, cite both sources, and recommend whether to update wiki, code, or a follow-up spec.
- What if a recommendation would require runtime behavior changes? The review must label it as future work and must not implement it in this planning pass.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The review MUST be limited to `apps/api/app`, API tests, and API-relevant wiki decisions; frontend UI and worker internals are out of scope except where they define API boundaries.
- **FR-002**: The review MUST ingest and cite the wiki architecture spine, including `Home.md`, `Layer Boundaries.md`, `ETL Architecture.md`, `ETL Plugin Contracts.md`, `LangGraph ETL Decision.md`, `RAG Retrieval Architecture.md`, `Corpus Management Architecture.md`, `Chat Sessions Architecture.md`, and `Queue Architecture.md` when relevant.
- **FR-003**: The review MUST map the current API entrypoints, including FastAPI app wiring, routers, dependencies, request/response schemas, auth/session handling, upload/job routes, records routes, archive routes, and health checks.
- **FR-004**: The review MUST map API-layer service and boundary patterns, including route-thinness, dependency injection, service classes/functions, persistence access, error mapping, metadata sanitization, and test seams.
- **FR-005**: The review MUST compare observed API patterns against the durable boundaries in the wiki and constitution.
- **FR-006**: The review MUST categorize findings as alignment, risk, inconsistency, or improvement opportunity.
- **FR-007**: Each non-trivial finding MUST include evidence references to files, wiki pages, tests, or contracts.
- **FR-008**: Recommendations MUST be prioritized and scoped by likely follow-up type: documentation, refactor, contract/schema, test coverage, or future feature.
- **FR-009**: The planning artifacts MUST define an output contract for the review report so later execution can be verified without relying on subjective prose.
- **FR-010**: This feature MUST NOT implement API behavior changes, database migrations, route changes, schema changes, frontend changes, or runtime refactors.

### Key Entities *(include if feature involves data)*

- **API route surface**: FastAPI route modules and their request/response dependencies.
- **API service seam**: Service or helper boundary invoked by routes, including retrieval, chat, ingestion, corpus, archive, auth, and lifecycle seams.
- **Wiki decision**: Durable architecture guidance from `docs/wiki/` that constrains API-layer direction.
- **Review finding**: Evidence-backed observation categorized as alignment, risk, inconsistency, or improvement opportunity.
- **Recommendation**: Prioritized, scoped suggestion for future work with affected files and verification expectations.
- **Review contract**: The expected structure and completeness rules for the final architecture review artifact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The generated review contract lets a reviewer verify that every finding has category, evidence, impact, and suggested next step.
- **SC-002**: The planning bundle contains no unresolved template placeholder markers.
- **SC-003**: The quickstart gives executable commands to enumerate API routes, wiki anchors, and placeholder checks.
- **SC-004**: The plan explicitly states that this pass is review/design only and does not permit runtime API changes.
- **SC-005**: The review scope can be executed independently from the existing `001-live-db-backed-queue` feature.

## Assumptions

- The phrase "apu layer" means the FastAPI/API layer under `apps/api/app`.
- The requested "review" is a planning and analysis feature, not immediate implementation of suggested improvements.
- The wiki under `docs/wiki/` is the durable source of architecture direction unless the review finds a concrete mismatch.
- Existing tests under `apps/api/tests` are part of the API-layer evidence set.
- Suggestions for improvement should become future bounded specs or OMO plans before code changes are made.
