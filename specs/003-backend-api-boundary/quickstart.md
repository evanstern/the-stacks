# Quickstart: API Boundary Architecture

## What this feature is for

Use this Spec Kit bundle to document the backend API boundary as a durable wiki contract. The feature is documentation-only, so validation focuses on the written architecture notes, the wiki reading order, and the public contract language that future refactor phases must follow.

## Scope

In scope:

- `specs/003-backend-api-boundary/spec.md`
- `specs/003-backend-api-boundary/research.md`
- `specs/003-backend-api-boundary/data-model.md`
- `specs/003-backend-api-boundary/quickstart.md`
- `docs/wiki/Home.md`
- `docs/wiki/Layer Boundaries.md`
- The future `docs/wiki/API Boundary Architecture.md` page this feature is meant to anchor

Out of scope:

- Runtime API changes
- Database migrations
- New routes or schemas
- Frontend changes
- Broad refactors outside the documented API boundary contract

## Read order

1. `specs/003-backend-api-boundary/spec.md`
2. `specs/003-backend-api-boundary/research.md`
3. `specs/003-backend-api-boundary/data-model.md`
4. `specs/003-backend-api-boundary/quickstart.md`
5. `docs/wiki/Home.md`
6. `docs/wiki/Layer Boundaries.md`
7. `docs/wiki/Chat Sessions Architecture.md`
8. The rest of the linked wiki architecture pages as needed for boundary context

## What a reviewer should check

- The API boundary contract is described as a durable wiki page, not as a planning artifact.
- Route ownership is limited to HTTP adaptation, dependency wiring, status codes, and public response shaping.
- Service ownership stays focused on durable workflow and collaborator orchestration outside HTTP mechanics.
- Dependency injection seams are named clearly enough that route tests can override them without touching service internals.
- Public error mapping stays terse and safe, especially for the documented 400, 401, 404, 413, 415, and server-failure cases already reflected in the API boundary research.
- Response contracts are described through public schemas and `response_model` style boundaries, not internal ORM objects.
- Route tests and service tests are separated by seam, with dependency overrides called out as the preferred route isolation pattern.
- The wiki preflight and postflight rule is explicit, repeatable, and aimed at future backend refactor phases.

## Validation commands

Run these from the repository root to confirm the documentation bundle is concrete and placeholder-free:

```bash
rg -n "draft note|open question|template marker|unresolved marker" specs/003-backend-api-boundary
```

Confirm the repo wiki spine still points readers through the architecture notes that this feature depends on:

```bash
rg -n "API Boundary Architecture|Layer Boundaries|Chat Sessions Architecture|current reading order|updated frontmatter" docs/wiki
```

Check that the data model names the core boundary concepts the feature is trying to lock down:

```bash
rg -n "Route Boundary|Service Seam|Dependency Seam|Public Error Mapping|Response Contract|Test Seam|Wiki Preflight and Postflight Checks" specs/003-backend-api-boundary/data-model.md
```

Inspect the feature docs together to confirm they describe the same contract from different angles:

```bash
sed -n '1,220p' specs/003-backend-api-boundary/data-model.md
sed -n '1,220p' specs/003-backend-api-boundary/quickstart.md
```

## Expected review result

The bundle should read like a durable architecture contract for backend API boundaries. A reviewer should be able to use it to check wiki alignment, route-versus-service ownership, dependency injection conventions, error mapping, response shape expectations, and the required wiki preflight/postflight rule without needing to consult planning chat history.
