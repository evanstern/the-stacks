# Research: API Boundary Hardening for Session Messages

## Purpose

This feature is code-first. The research here exists to pin down the runtime seam around `POST /sessions/{session_id}/messages`, keep the route boundary thin, and make sure the tests can isolate the seam cleanly.

## Decisions

### 1. The feature should center on the session message route, not the wiki

**Decision**: Treat `POST /sessions/{session_id}/messages` as the primary implementation slice. Keep the companion `GET /sessions/{session_id}/messages` path in scope only if it is needed to keep the boundary coherent.

**Rationale**: The live code already shows the sharpest seam in `apps/api/app/routes_sessions.py`. That route has explicit dependencies, a response model, and public error mapping, and the strongest follow-up tests already target the same area. A code-first slice should harden what the runtime already exposes instead of expanding the docs spine again.

**Alternatives considered**:

- Keep the feature focused on docs and wiki alignment. Rejected because this task is explicitly about runtime code and tests.
- Broaden the slice to every route in `apps/api/app/`. Rejected because that would turn a focused boundary hardening task into a broad refactor.

### 2. Routes own HTTP adaptation, the chat service owns the durable workflow

**Decision**: `apps/api/app/routes_sessions.py` should keep request parsing, dependency wiring, status mapping, and public response shaping. `apps/api/app/chat_session_service.py` should keep the durable message workflow, retrieval orchestration, citation assembly, and persistence-heavy logic.

**Rationale**: The route already delegates to the chat service boundary. That separation keeps HTTP mechanics out of the workflow and gives the tests a clean line between boundary behavior and service behavior.

**Alternatives considered**:

- Move more orchestration into the route. Rejected because it would make the route brittle and less reusable.
- Put HTTP status logic into the service layer. Rejected because that would leak public API decisions into the service seam.

### 3. Named dependency providers are the right test seam

**Decision**: Keep named FastAPI dependency providers in `routes_sessions.py` as the override surface for tests. `app.dependency_overrides` should remain the preferred isolation tool in `test_contracts.py`, `test_chat_rag.py`, and `test_sessions.py`.

**Rationale**: The route tests already use dependency overrides, which makes it possible to swap fake chat, Qdrant, embedding, graph, and retrieval collaborators without monkeypatching internals. That keeps the route contract stable and the tests readable.

**Alternatives considered**:

- Monkeypatch service methods directly in tests. Rejected because it hides the route seam and couples tests to internals.
- Introduce a heavyweight service container abstraction. Rejected because the current named provider seam is already enough.

### 4. Public error mapping should stay terse and route-owned

**Decision**: Preserve public-safe `HTTPException` mapping at the route boundary. Keep `404 Session not found` for missing sessions, `503` for expected unavailable collaborators, and `500` for incomplete persisted turn failures already surfaced by the service.

**Rationale**: The route is the public contract. If the route leaks service internals or varies the public status mapping, the API becomes harder to reason about and harder to test.

**Alternatives considered**:

- Return raw service errors to the client. Rejected because it leaks internal details.
- Normalize every failure into one generic status. Rejected because it would erase meaningful public contract distinctions already present in the code.

### 5. Response models and schemas stay the source of truth

**Decision**: Keep `apps/api/app/schemas.py` as the source of truth for the public contract, and keep `response_model=ChatMessageEnvelope` on the route.

**Rationale**: The session message route already exposes a schema boundary. That boundary should be hardened in code and tests, not replaced with internal objects or ad hoc JSON.

**Alternatives considered**:

- Return internal ORM rows directly. Rejected because it weakens the public contract.
- Document the response shape only in prose. Rejected because the schema layer already exists and should remain authoritative.

### 6. Route tests should validate the boundary, service tests should validate the workflow

**Decision**: Route tests should stay focused on HTTP semantics, public response shape, and dependency override behavior. Service tests should focus on the durable chat workflow and persistence behavior.

**Rationale**: Splitting tests this way keeps the suite fast and makes it obvious which layer failed when a regression lands.

**Alternatives considered**:

- Test the route only through full end-to-end smoke paths. Rejected because it is too broad for a boundary hardening task.
- Collapse route and service tests into one style. Rejected because that would blur the seam the feature is trying to protect.

## Durable boundary summary

- `apps/api/app/routes_sessions.py` is the thin HTTP boundary for session messages.
- `apps/api/app/chat_session_service.py` is the service seam behind the route.
- `apps/api/app/schemas.py` owns the public response contract.
- `apps/api/tests/test_contracts.py`, `apps/api/tests/test_chat_rag.py`, and `apps/api/tests/test_sessions.py` are the main verification surfaces.
- The wiki and planning notes stay supporting context only.

## Open questions resolved

The feature scope is intentionally narrow. The only companion path that might stay in scope is the session read path, and only if the route/service boundary needs it to stay coherent.
