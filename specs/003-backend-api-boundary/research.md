# Research: API Boundary Architecture

## Purpose

This feature is not introducing new runtime behavior. Its job is to turn the existing wiki preflight findings and FastAPI boundary evidence into a durable architecture note that future backend refactor phases can rely on without re-discovering the same contracts.

## Decisions

### 1. Keep the durable API contract in the wiki spine, not in a planning artifact

**Decision**: Create and maintain `docs/wiki/API Boundary Architecture.md` as the durable API boundary contract. Link it from `docs/wiki/Home.md`, and let `docs/wiki/Layer Boundaries.md` point to it or align with it without repeating the full contract.

**Rationale**: The project already treats `docs/wiki/` as the canonical durable layer. The wiki preflight showed that `Home.md` owns the reading order and `Layer Boundaries.md` owns the cross-layer seam map. The new API page should sit between them as the API-specific contract, so later refactors can find one source of truth quickly.

**Alternatives considered**:

- Expand `Layer Boundaries.md` with the full API contract. Rejected because it would turn the seam map into a long mixed-purpose page and make the architecture spine harder to scan.
- Keep the findings only in `specs/002-api-architecture-review/`. Rejected because planning docs are evidence, not durable state.

### 2. Routes own HTTP adaptation, services own domain workflow

**Decision**: FastAPI route modules own request parsing, dependency wiring, status codes, public response shaping, and `HTTPException` mapping. Service modules own the durable workflow, persistence-heavy logic, and collaborator orchestration that should not depend on HTTP mechanics.

**Rationale**: The FastAPI docs and the local code pattern both point the same way. Routes are the public boundary, while services keep the domain logic testable and reusable. This keeps HTTP-specific changes out of the core workflow and gives a clear place to map internal failures to public responses.

**Alternatives considered**:

- Put most boundary logic in services and let routes stay almost empty. Rejected because services would then know too much about HTTP status codes and response shapes.
- Put all orchestration in routes. Rejected because that makes the boundary brittle and duplicates logic across endpoints.

### 3. Use FastAPI dependency injection as the named test seam

**Decision**: Treat `Depends(...)` and `Annotated[..., Depends(...)]` as the public seam for route dependencies such as DB sessions, settings, auth/session state, embeddings, Qdrant, retrieval, chat, and other external collaborators. Keep route-local provider functions where tests need to override a collaborator without touching the internal service implementation.

**Rationale**: FastAPI’s documented pattern makes dependency providers the right boundary for substitution in tests. The current routes already follow this by using named dependency functions and `app.dependency_overrides` in tests. That gives route tests a stable way to isolate HTTP behavior from downstream services.

**Alternatives considered**:

- Instantiate collaborators directly in route functions. Rejected because it removes test seams and makes route tests depend on real infrastructure.
- Hide collaborators behind a single global service container. Rejected because it blurs route-level seams and makes per-test overrides less explicit.

### 4. Map expected failures at the route boundary with public-safe errors

**Decision**: Routes should convert expected client-visible failures into `HTTPException` responses with terse, public-safe details. Use route-level or API-level handlers only when a framework or validation error needs global mapping. Do not leak service internals, tracebacks, or storage details into public responses.

**Rationale**: The local API already uses explicit route errors for common cases such as invalid credentials, missing resources, unsupported uploads, and service failures. FastAPI documents `HTTPException` as the normal path-operation error tool, so the route boundary is the right place to translate internal failures into public statuses.

**Alternatives considered**:

- Return rich internal error objects to the client and let the frontend interpret them. Rejected because it exposes implementation details and weakens the public contract.
- Centralize every possible error into one generic envelope before the route sees it. Rejected because it hides useful status distinctions that the current API already documents.

### 5. Declare response contracts with `response_model` and Pydantic schemas

**Decision**: Treat `response_model` and the Pydantic schemas in `schemas.py` as the authoritative public response contract. Routes should return schemas, not internal ORM rows or service internals, and should use `responses={...}` only when a route intentionally exposes alternate public statuses.

**Rationale**: FastAPI validates and filters output through `response_model`, which keeps public responses stable and prevents accidental leakage of internal fields. The local code already follows this pattern across auth, sessions, uploads, records, and ingestion routes.

**Alternatives considered**:

- Return raw Python dictionaries or ORM objects from route handlers. Rejected because it weakens contract enforcement and makes accidental field exposure easy.
- Document response shapes only in prose. Rejected because the code already has schema classes that should remain the source of truth.

### 6. Use route tests for HTTP behavior and dependency overrides for isolation

**Decision**: Route-level tests should use `TestClient(app)` with `app.dependency_overrides` to swap DB, settings, auth, and collaborator dependencies. Service tests should focus on internal workflow seams without requiring HTTP setup. Clear overrides after each test or fixture.

**Rationale**: This keeps route tests focused on the boundary contract, not on the internals of the services behind it. The current test suite already uses this pattern, including local route dependency factories for chat and retrieval seams.

**Alternatives considered**:

- Test routes only through end-to-end smoke tests. Rejected because it is too slow and too coarse for boundary regressions.
- Mock every internal call with monkeypatching instead of dependency overrides. Rejected because it couples tests to implementation details and makes seams harder to reason about.

### 7. Make wiki preflight and postflight a required backend refactor rule

**Decision**: Future backend refactor phases must read `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, `docs/wiki/API Boundary Architecture.md`, and any phase-relevant layer pages before code changes. After implementation, they must re-read the same pages, refresh `updated` frontmatter on any changed wiki pages, and record whether any code/wiki mismatch was fixed, deferred, or intentionally left unchanged.

**Rationale**: The wiki is the durable architecture layer. Preflight stops refactors from drifting away from documented boundaries, and postflight ensures that the wiki stays honest after the code changes land.

**Alternatives considered**:

- Review the wiki only once at the start of a refactor. Rejected because it does not catch drift introduced during implementation.
- Update the wiki informally in task notes without a documented postflight rule. Rejected because the process becomes easy to skip and hard to audit.

## Durable boundary summary

- `docs/wiki/Home.md` is the entry point for reading order.
- `docs/wiki/Layer Boundaries.md` stays concise and points to the API boundary note when API-specific ownership is discussed.
- `docs/wiki/API Boundary Architecture.md` owns the API route/service contract, dependency seams, error mapping, response contract, test seams, and wiki preflight/postflight rules.
- Planning artifacts and review notes remain evidence, not the durable contract.

## Open questions resolved

All planning unknowns are resolved by the decisions above. No NEEDS CLARIFICATION items remain for the research stage.
