# Data Model: API Boundary Hardening for Session Messages

## Overview

This package does not add new domain entities. It describes the runtime boundary objects, response contracts, and test seams that the implementation must keep stable while hardening the session message API.

## Entities

### Session Message Route Boundary

- **Purpose**: The public HTTP seam for `POST /sessions/{session_id}/messages`, with the companion read path included only if needed to keep the boundary coherent.
- **Fields**: route path, HTTP method, auth dependency, DB dependency, settings dependency, chat dependency, graph dependency, retrieval dependency, response model, public error mapping.
- **Relationships**: Delegates to the chat session service seam and emits public response models.
- **Validation rules**: Must keep request parsing, dependency wiring, public statuses, and `response_model` at the route layer.

### Chat Session Service Seam

- **Purpose**: The durable workflow behind the session message route.
- **Fields**: service module path, entry points, persistence operations, retrieval orchestration, citation assembly, failure modes.
- **Relationships**: Accepts route inputs and returns the assistant turn or a service-level failure that the route maps to public HTTP output.
- **Validation rules**: Must stay HTTP-agnostic and must not know about FastAPI response objects.

### Dependency Override Seam

- **Purpose**: The named FastAPI provider functions that tests can replace.
- **Fields**: provider name, collaborator, override target, test file, scope.
- **Relationships**: Connects the route boundary to fake chat, graph, embedding, Qdrant, and retrieval collaborators.
- **Validation rules**: Must stay named and replaceable through `app.dependency_overrides`.

### Public Error Contract

- **Purpose**: The public-safe HTTP responses emitted when the session message boundary fails.
- **Fields**: status code, detail text, origin layer, affected route, public visibility.
- **Relationships**: Is emitted by the route boundary and asserted by route tests.
- **Validation rules**: Must keep details terse and avoid leaking traces or internal storage metadata.

### Response Contract

- **Purpose**: The schema returned to clients for successful session message requests.
- **Fields**: schema name, route path, success status, serialized message fields, citation metadata, no-evidence flag.
- **Relationships**: Is owned by `apps/api/app/schemas.py` and consumed by the route boundary.
- **Validation rules**: Must return `ChatMessageEnvelope` and nested `ChatMessageRead` shapes instead of internal ORM rows.

### Route/Service Test Seam

- **Purpose**: The split between route-level HTTP tests and service-level workflow tests.
- **Fields**: test file, client type, override targets, assertion focus.
- **Relationships**: Uses the route boundary for HTTP assertions and the service seam for workflow assertions.
- **Validation rules**: Route tests should use `TestClient(app)` plus dependency overrides, and overrides must be cleared after each fixture or test.

## Relationships Summary

- The route boundary owns the public HTTP contract for session messages.
- The service seam owns the durable work behind that route.
- Dependency overrides are the preferred way to isolate the route in tests.
- Public errors and response models stay route-owned and schema-driven.

## Validation Rules

- The package should stay code-first and runtime-focused.
- The package should not broaden into unrelated API routes.
- The package should keep docs and wiki references secondary to the runtime seam and its tests.
