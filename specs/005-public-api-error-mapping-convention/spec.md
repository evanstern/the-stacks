# Feature Specification: Public API Error Mapping Convention

**Feature Branch**: `[005-public-api-error-mapping-convention]`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Create the docs-only R3 artifact package for the public API error-mapping convention. This is a writing task only: produce the new Spec Kit docs package and only add a short wiki pointer if it is truly needed. Base the package on roadmap R3: public API error mapping convention. Use the exact route examples from routes_sessions.py, routes_uploads.py, routes_ingestion.py, routes_records.py, routes_archives.py, and auth.py. Keep the package narrow: docs/spec only, not runtime refactor. Prefer the observed repo behavior over generic HTTP theory."

## Purpose

This package records the public API error-mapping convention already visible in the current backend routes and auth boundary. It is a docs-only R3 artifact, so the job here is to name the convention clearly, show the live examples, and point later implementation work at the right seam without changing runtime behavior now.

## Current route examples

These examples come from the live route and auth modules, and they are the basis for the convention.

- `apps/api/app/auth.py`
  - `current_admin_session()` returns `401` with `Not authenticated` for missing, bad, or expired session state.
  - `_serializer()` raises `500` when the session secret is not configured.
- `apps/api/app/routes_sessions.py`
  - Session reads and `POST /sessions/{session_id}/messages` return `404 Session not found` when the session is missing.
  - Chat or retrieval dependency failures return public-safe `503` details such as `Embedding service is unavailable`, `Retrieval index is unavailable`, or `Chat response service is unavailable`.
  - A `LookupError` path currently returns `500` with the exception text.
- `apps/api/app/routes_uploads.py`
  - Upload validation returns `400` for unsafe or invalid client input.
  - Unsupported upload types return `415`.
  - Batch size limits return `413`.
  - Missing upload batches return `404 Upload batch not found`.
  - Unsafe batch child errors are redacted to keep the public detail short.
- `apps/api/app/routes_ingestion.py`
  - Missing jobs and missing job events return `404 Ingestion job not found`.
  - Public failure metadata keeps diagnostics out of the exposed response.
- `apps/api/app/routes_records.py`
  - Missing uploads and missing source chunks return `404` with public-safe details.
  - Public record metadata strips internal path values.
- `apps/api/app/routes_archives.py`
  - Archive lookup and validation paths return `400` or `404` depending on whether the request is malformed or the public resource is missing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make the public error convention easy to read and reuse

As a backend maintainer, I need one concise docs package that lists the public error mapping convention so I can see which status codes the API uses for client errors, missing resources, oversized uploads, unsupported types, and safe server failures.

**Why this priority**: The rule already exists in code, but it is spread across route modules. A single note makes the contract easier to spot and harder to misread.

**Independent Test**: A reviewer can read the new spec, follow the route examples, and confirm the convention matches the current API behavior without opening runtime code changes.

**Acceptance Scenarios**:

1. **Given** a maintainer scans the docs package, **When** they look for the public failure mapping, **Then** they can find `400`, `401`, `404`, `413`, `415`, and the safe server-failure shapes in one place.
2. **Given** a later implementation task uses this package, **When** it needs a route example, **Then** it can point at the live route modules instead of inferring the convention from generic HTTP theory.

---

### User Story 2 - Keep the scope narrow and public-safe

As a reviewer, I need the package to stay narrow so it documents the current public convention without expanding into a runtime refactor, a new error framework, or a new status-code policy.

**Why this priority**: This is a docs-only package. If it drifts into implementation work, the R3 note stops being a stable planning artifact.

**Independent Test**: A reviewer can compare the package against the roadmap and see that the scope stays inside the current route examples and the existing public-safe behavior.

**Acceptance Scenarios**:

1. **Given** the package is complete, **When** someone reads the non-goals, **Then** they can see that runtime code, migrations, frontend work, and status-code redesign are out of scope.
2. **Given** a server failure is documented, **When** the note describes it, **Then** it keeps the public message terse and avoids tracebacks, file paths, or other internal detail.

---

### User Story 3 - Leave a clear path for the later implementation slice

As a future implementer, I need the docs package to point at the later code-first path so the next feature can harden the boundary without reopening the roadmap discussion.

**Why this priority**: The docs should settle the convention now and leave the runtime hardening to a later feature that can focus on tests and route changes.

**Independent Test**: A reviewer can read the later implementation path and see that it points back to the route modules, route tests, and the current public contract rather than to a wider rewrite.

**Acceptance Scenarios**:

1. **Given** someone wants to turn this note into code, **When** they look for the next step, **Then** they can see the route and test files that should be hardened later.
2. **Given** the docs package is used as planning context, **When** a future feature starts, **Then** it can keep the same status-code vocabulary and only change runtime behavior if a later spec says so.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST document the public API error-mapping convention as a docs-only R3 artifact.
- **FR-002**: The package MUST cover the current public behavior for `400`, `401`, `404`, `413`, `415`, and safe server failures.
- **FR-003**: The package MUST cite the live route examples from `apps/api/app/auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, and `apps/api/app/routes_archives.py`.
- **FR-004**: The package MUST prefer observed repo behavior over generic HTTP theory when the two overlap.
- **FR-005**: The package MUST include non-goals that rule out runtime refactors, new status codes, and broader API redesign.
- **FR-006**: The package MUST include verification anchors for placeholder scanning and a docs-only git diff check.
- **FR-007**: The package MUST include a later implementation path that points back to the route and test files, not to a new wiki-first change.
- **FR-008**: The package MUST stay narrow and MUST NOT expand into R2 upload orchestration work or R4 chat facade cleanup.

### Non-goals

- Change the current public status codes just to make the note simpler.
- Rework route internals or add a new runtime error layer.
- Expand the package into uploads, queue, chat, or corpus refactors.
- Add new wiki pages unless a short pointer is truly needed.

### Later implementation path

The later code-first follow-up should harden the boundary in the live route modules and route tests that already exhibit the convention. The obvious follow-up files are `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`, `apps/api/app/auth.py`, and the tests that already pin the current public contract.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can read the package and see the current public error convention without opening runtime code.
- **SC-002**: The package records the exact route examples that show the `400`, `401`, `404`, `413`, `415`, and safe server-failure behavior.
- **SC-003**: The scope stays docs-only and does not pull in a runtime refactor or a new API policy.
- **SC-004**: The package includes a clear later implementation path for the eventual code-first follow-up.
- **SC-005**: The changed markdown files pass placeholder scan and docs-only diff verification.

## Assumptions

- The current route behavior is stable enough to document before any later hardening work starts.
- The wiki already has the durable API boundary notes, so this package only needs a short pointer if a page would otherwise duplicate them.
- The next implementation feature will use these docs as a source note, not as a substitute for runtime verification.
