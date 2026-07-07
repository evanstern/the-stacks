# Research: API Layer Architecture Review

## Scope decision

Decision: Treat this feature as a review/design planning bundle for the API layer only.

Rationale: The user asked for a full sweep of architecture, decisions, design, and pattern usage, with suggestions for improvements. That is an evidence-gathering and recommendation workflow, not a runtime implementation request.

Alternatives considered: Implement immediate API refactors. Rejected because the requested output is a review and because the constitution requires durable architecture changes to be planned, verified, and recorded before behavior changes.

## Feature boundary decision

Decision: Create a separate Spec Kit feature at `specs/002-api-architecture-review/`.

Rationale: Running `/speckit.plan` without an override resolved to `specs/001-live-db-backed-queue`, which is a queue documentation feature and does not match this request. A separate feature prevents overwriting the queue plan and keeps the API review independently executable.

Alternatives considered: Reuse `001-live-db-backed-queue`. Rejected because its scope explicitly excludes broader ETL/chat/corpus ownership changes and is only about DB-backed queue claim/status documentation.

## Wiki ingestion decision

Decision: The review must start from the wiki spine and then test it against current API code.

Rationale: `docs/wiki/Home.md` defines the reading order, and `docs/wiki/Layer Boundaries.md` records current module seams for ingestion, retrieval, corpus lifecycle, chat session orchestration, upload/job records, and queue status. The constitution requires durable architecture decisions to live in `docs/wiki/`.

Alternatives considered: Review code first and use wiki only as background. Rejected because the user explicitly asked to ingest the wiki and align direction based on that data.

## API surface decision

Decision: Include FastAPI app wiring, routers, schemas, route dependencies, services, persistence models, and API tests in the review scope.

Rationale: `apps/api/app/main.py` wires the public API surface through `routes_auth`, `routes_archives`, `routes_ingestion`, `routes_records`, `routes_sessions`, and `routes_uploads`. `apps/api/app/schemas.py` defines response/request models. `apps/api/tests` contains route, service, contract, retrieval, upload, worker, and corpus coverage that reveal intended API behavior.

Alternatives considered: Limit the review to route modules only. Rejected because route design depends on service seams, schemas, auth dependencies, database sessions, and error mapping.

## Pattern decision

Decision: Review patterns by layer seam rather than by individual file inventory.

Rationale: The wiki already groups the API around ETL, retrieval, corpus, chat, queue, and operator-facing records. A file-by-file review would be noisy and would not produce actionable architecture direction.

Alternatives considered: Produce a generic FastAPI checklist. Rejected because this project has explicit architecture boundaries and evidence/provenance constraints.

## Output contract decision

Decision: Create a contract for the final review report under `contracts/review-report.md`.

Rationale: The review needs a verifiable structure: scope, evidence inventory, route/service map, pattern assessment, findings, recommendations, non-goals, and wiki-impact decision. This makes a later `/speckit.tasks` or implementation pass testable.

Alternatives considered: Put expectations only in `quickstart.md`. Rejected because quickstart is a validation guide, while the review output itself needs a stable contract.

## FastAPI review rubric decision

Decision: Evaluate API pattern usage against FastAPI's intended architecture seams: routers for API organization, dependencies for cross-cutting concerns, Pydantic models for public contracts, error mapping at the HTTP boundary, and dependency overrides for testability.

Rationale: FastAPI's official guidance treats `APIRouter` as the route grouping/composition mechanism, supports router-level dependencies for shared concerns, uses `response_model` for validation/filtering/documentation of public output, maps HTTP failures through `HTTPException` or exception handlers, and supports `app.dependency_overrides` for tests. These practices match the project's existing route/service split and give the later review a concrete rubric.

Alternatives considered: Use a generic clean-architecture checklist. Rejected because the review should assess this FastAPI codebase on framework-native boundaries and the project's existing wiki-defined seams.

Reference anchors:

- FastAPI larger applications and `APIRouter` organization: `https://github.com/fastapi/fastapi/blob/5cdf820c8046edaf83c306ebd7435f038fc4a75a/docs/en/docs/tutorial/bigger-applications.md`
- FastAPI response models as output contracts: `https://github.com/fastapi/fastapi/blob/5cdf820c8046edaf83c306ebd7435f038fc4a75a/docs/en/docs/tutorial/response-model.md`
- FastAPI error handling: `https://github.com/fastapi/fastapi/blob/5cdf820c8046edaf83c306ebd7435f038fc4a75a/docs/en/docs/tutorial/handling-errors.md`
- FastAPI dependency overrides for tests: `https://github.com/fastapi/fastapi/blob/5cdf820c8046edaf83c306ebd7435f038fc4a75a/docs/en/docs/advanced/testing-dependencies.md`

## Known evidence anchors

- `docs/wiki/Home.md`: current architecture reading order.
- `docs/wiki/Layer Boundaries.md`: module seams and ownership/non-ownership lines.
- `docs/wiki/ETL Architecture.md`: upload, worker claim, ingestion, embedding, indexing, and error handling boundaries.
- `docs/wiki/RAG Retrieval Architecture.md`: retrieval scope, trace, ranking, weak result, and active-runtime rules.
- `docs/wiki/Chat Sessions Architecture.md`: thin session route boundary and chat-owned orchestration.
- `apps/api/app/main.py`: router wiring and health endpoint.
- `apps/api/app/routes_sessions.py`: route dependency injection and chat failure mapping.
- `apps/api/app/routes_uploads.py`: upload validation, batch expansion, job creation, safe child errors.
- `apps/api/app/retrieval_service.py`: retrieval scope, lookup/ranking adapters, trace metadata.
- `apps/api/app/chat_session_service.py`: chat turn persistence and retrieval/citation orchestration.
- `apps/api/app/models.py`: persisted entities that API schemas expose.
- `apps/api/app/schemas.py`: API response/request contract models.
- `apps/api/tests`: route/service/contract tests and dependency override patterns.

## Background exploration reconciliation

- Codebase exploration confirmed there was no existing matching Spec Kit API-architecture feature before `002-api-architecture-review`; the only prior Spec Kit feature was `001-live-db-backed-queue`.
- Codebase exploration confirmed the current API architecture is documented piecemeal across layer-specific wiki pages rather than a single API architecture page.
- Codebase exploration confirmed the route/service split used in this plan: `main.py` composes routers, route modules own HTTP boundaries, and service modules own orchestration and persistence-heavy behavior.
- External FastAPI research confirms the review contract should explicitly assess router organization, dependency usage, response-model contracts, error mapping, and dependency override testability.
