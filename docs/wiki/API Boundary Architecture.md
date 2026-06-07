---
title: API Boundary Architecture
status: active
owner: docs
created: 2026-06-07
updated: 2026-06-07
tags:
  - wiki
  - architecture
  - api
---

# API Boundary Architecture

This page is the durable API contract for the backend boundary. It stays focused on route ownership, service ownership, dependency injection, public errors, response schemas, and test seams.

## What belongs in routes

FastAPI route modules own the HTTP boundary.

- Parse request input and path/query/body parameters.
- Compose dependencies with `Depends(...)` or `Annotated[..., Depends(...)]`.
- Call service modules or other backend seams.
- Translate domain outcomes into public status codes and response models.
- Raise public-safe `HTTPException` values for expected client-visible failures.

Routes should stay thin. They should not absorb durable domain logic, orchestration, or persistence-heavy behavior that belongs in service modules.

## What belongs in services

Service modules own the durable workflow behind the HTTP layer.

- Implement chat, retrieval, ingestion, corpus, and other backend workflows.
- Coordinate persistence and collaborators that do not need to know about HTTP.
- Return values or domain failures that routes can map to public responses.

If a service starts making HTTP decisions, move that decision back to the route boundary.

## Dependency injection conventions

Use explicit dependency providers for request-time collaborators.

- Database sessions come from route-visible providers such as `get_db`.
- Settings and secrets come from `get_settings` or a local route seam that wraps them.
- Session/auth state comes from a dedicated auth dependency such as `current_admin_session`.
- External collaborators like embeddings, Qdrant, retrieval, chat, or graph clients should be exposed through named provider seams when tests need to override them.

Prefer injectable callables over direct construction inside route handlers. That keeps the HTTP layer testable without pulling service setup into every test.

## Public error mapping

Routes must protect the public contract when things fail.

- Use terse, public-safe details for expected client errors.
- Return `400` for invalid input and empty or malformed client requests.
- Return `401` for authentication failures.
- Return `404` when a public resource is missing.
- Return `413` for payloads or uploads that exceed limits.
- Return `415` for unsupported media or file types.
- Return server-failure statuses only when the route cannot safely recover.

The rule is simple: do not leak internal stack traces or service internals through the HTTP boundary.

## Response schema and contract expectations

Public API shapes should be defined by response models, not by internal ORM objects or ad hoc dictionaries.

- Declare `response_model=` for the public contract whenever the route returns structured JSON.
- Use dedicated schema classes for request and response payloads.
- Shape alternate public statuses explicitly when a route needs more than one public outcome.
- Keep route responses aligned with the public API, even if the internal service returns richer data.

The API boundary should expose the public contract and hide internal implementation detail.

## Test seam expectations

Route tests should verify the HTTP boundary without depending on full backend internals.

- Use `TestClient(app)` for route-level contract tests.
- Override dependencies with `app.dependency_overrides` when a route needs isolated DB, settings, auth, retrieval, embedding, Qdrant, chat, or graph behavior.
- Clear overrides after each test or fixture.
- Keep service tests focused on the durable workflow, not on HTTP mechanics.

This split lets route tests prove the API contract while service tests prove the backend behavior.

## Wiki preflight rule for future backend refactors

Before a backend refactor starts, read the current architecture spine in this order:

1. [[Home]]
2. [[Layer Boundaries]]
3. [[API Boundary Architecture]]
4. Any phase-relevant layer pages touched by the change

Then compare the current code against those pages.

- If the code and wiki disagree, update the wiki, update the code, or record a bounded follow-up note.
- Do not silently pick one source of truth.

## Wiki postflight rule for future backend refactors

After the change lands, re-read the same pages and confirm the architecture notes still match reality.

- Refresh the `updated` frontmatter on any wiki page you changed.
- Keep `Layer Boundaries.md` concise and point API-specific readers here instead of duplicating the full contract.
- Record any intentional mismatch or follow-up separately so future phases know what still needs work.

## Related durable notes

- [[Layer Boundaries]] for the cross-layer map.
- [[Chat Sessions Architecture]] for the chat boundary that routes through this API contract.
- [[ETL Architecture]] for upload and ingestion ownership.
- [[RAG Retrieval Architecture]] for retrieval scope and answer-time behavior.
- [[Corpus Management Architecture]] for corpus scope and lifecycle rules.
- [[Queue Architecture]] for the current queue placeholder.
