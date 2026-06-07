# Data Model: API Boundary Architecture

## Overview

This feature documents the durable API boundary contract for the backend refactor. It does not add runtime entities. The model below describes the architecture notes and verification concepts that the documentation must capture so future refactor phases can reuse one source of truth.

## Entities

### API Boundary Note

- **Purpose**: The durable wiki page that records the API route and service contract for the backend boundary.
- **Fields**: page path, title, status, created date, updated date, summary, linked pages, covered topics, preflight rule, postflight rule.
- **Relationships**: References route boundaries, service seams, dependency seams, response contracts, error mapping rules, and test seams.
- **Validation rules**: Must live in the wiki spine, not only in planning artifacts; must be linked from `docs/wiki/Home.md`; must point to `docs/wiki/Layer Boundaries.md` rather than duplicating the full layer map.

### Route Boundary

- **Purpose**: A FastAPI route module or endpoint group that owns HTTP adaptation.
- **Fields**: module path, route prefix, request parsing responsibility, dependency providers, status code mapping, public response model, public error mapping.
- **Relationships**: Calls one or more service seams and emits one or more response contracts.
- **Validation rules**: Must own HTTP mechanics only, including dependency wiring and public response shaping, and must not absorb durable workflow logic.

### Service Seam

- **Purpose**: A backend service, facade, or adapter that owns durable workflow behind the HTTP boundary.
- **Fields**: module path, seam name, owned responsibility, downstream collaborators, persistence side effects, test coverage anchor.
- **Relationships**: Supports one or more route boundaries and may implement the business side of a wiki decision.
- **Validation rules**: Must remain HTTP-agnostic, with routes translating service outcomes into public HTTP responses.

### Dependency Seam

- **Purpose**: A named FastAPI dependency provider used as the override point in route tests.
- **Fields**: provider name, injected collaborator, override target, request scope, related route module.
- **Relationships**: Connects route boundaries to DB sessions, settings, auth/session state, embeddings, Qdrant, retrieval, chat, graph, or other external collaborators.
- **Validation rules**: Must be declared with `Depends(...)` or `Annotated[..., Depends(...)]`; should stay named so tests can override the provider without reaching into service internals.

### Public Error Mapping

- **Purpose**: The documented translation from internal failures to public-safe HTTP responses.
- **Fields**: status code, route or dependency origin, safe detail text, public visibility, affected endpoint group.
- **Relationships**: Is emitted by a route boundary or API-level handler and may be consumed by clients and route tests.
- **Validation rules**: Must stay terse and public-safe; common documented statuses include 400, 401, 404, 413, 415, and 500/503-style server failures when current behavior already demonstrates them.

### Response Contract

- **Purpose**: The public API shape exposed by a route through `response_model` or related schema declarations.
- **Fields**: schema name, route path, success status, alternate documented statuses, serialization rules, internal fields excluded from output.
- **Relationships**: Is owned by the route boundary and backed by `schemas.py` or an equivalent Pydantic model file.
- **Validation rules**: Must expose schemas rather than raw ORM rows or internal service objects; alternate public statuses should be documented when a route intentionally returns them.

### Test Seam

- **Purpose**: The documented route or service test pattern that keeps API boundary tests isolated and repeatable.
- **Fields**: test file, dependency override target, client type, fake collaborator, verification focus.
- **Relationships**: Uses route boundaries and dependency seams to isolate HTTP behavior from service implementation.
- **Validation rules**: Route tests should use `TestClient(app)` plus `app.dependency_overrides`; overrides must be cleared after each test or fixture so later cases start clean.

### Wiki Preflight and Postflight Checks

- **Purpose**: The required read-before-change and read-after-change rule for future backend refactor phases.
- **Fields**: required pages, pre-change review steps, post-change review steps, mismatch handling, update tracking.
- **Relationships**: Applies to the API boundary note, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, and any phase-relevant layer page.
- **Validation rules**: Must require a preflight read of the architecture spine before code changes and a postflight re-read after implementation; must record whether mismatches were fixed, deferred, or intentionally left unchanged.

## Relationships Summary

- The **API Boundary Note** owns the durable contract and links the rest of the entities together.
- Each **Route Boundary** depends on one or more **Dependency Seams** and invokes one or more **Service Seams**.
- Each **Route Boundary** exposes one or more **Response Contracts** and maps expected failures through **Public Error Mapping**.
- **Test Seams** verify that route behavior can be isolated with dependency overrides and that service seams remain independent of HTTP mechanics.
- **Wiki Preflight and Postflight Checks** govern how future refactor phases keep the wiki and the code aligned.

## Validation Rules

- The documentation must remain consistent with the current API boundary research and must not introduce new runtime behavior.
- The docs must preserve the separation between route ownership and service ownership.
- The docs must make dependency injection, error mapping, response models, and test overrides explicit enough for a future maintainer to follow without reading planning chat.
- The docs must be specific to this repository, using the current wiki spine and the existing API module names as references.
