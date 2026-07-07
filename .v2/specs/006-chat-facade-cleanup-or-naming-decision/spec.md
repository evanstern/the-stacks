# Feature Specification: Chat Facade Cleanup or Naming Decision

**Feature Branch**: `[006-chat-facade-cleanup-or-naming-decision]`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "Create docs-only R4 artifact package for chat facade cleanup or naming decision. Write new Spec Kit docs package. No runtime code."

## Purpose

This package records the current chat boundary and leaves a clean planning note for the R4 decision. The repo already shows a clear split: `routes_sessions.py` stays thin, `chat_rag.py` acts as a compatibility facade, and `chat_session_service.py` owns chat-turn orchestration. The point here is to document that split clearly, name the cleanup or renaming choice, and keep later implementation work pointed at the right seam without changing runtime behavior now.

## Current boundary, as observed in the repo

These are the live facts this package should preserve.

- `apps/api/app/routes_sessions.py`
  - The POST chat route is a thin HTTP boundary.
  - It wires dependencies, checks for a missing session, calls the chat service seam, and returns `ChatMessageEnvelope`.
  - Missing sessions map to `404 Session not found`.
  - Chat, retrieval, and embedding failures map to public-safe `503` details.
- `apps/api/app/chat_rag.py`
  - `answer_session_message()` remains the compatibility facade.
  - It preserves the old import path and delegates to `chat_session_service.py`.
  - The file still carries the LangGraph and dependency seam that older callers expect.
- `apps/api/app/chat_session_service.py`
  - This module owns the actual chat-turn orchestration.
  - It persists the user and assistant messages, manages retrieval runs, calls retrieval, validates and repairs citations, and returns the answer envelope.
- `apps/api/app/schemas.py`
  - The public chat response remains `ChatMessageEnvelope`.
- `apps/api/tests/test_chat_rag.py`, `apps/api/tests/test_contracts.py`, and `apps/api/tests/test_sessions.py`
  - The current tests pin the public answer boundary, dependency overrides, `404` missing-session behavior, and safe `503` failure shapes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make the chat facade split easy to read

As a backend maintainer, I need one concise docs package that explains the chat facade and service split so I can tell at a glance where the real orchestration lives and where the compatibility layer ends.

**Why this priority**: The behavior is already stable, but the names still cause confusion when someone tries to find the actual chat workflow.

**Independent Test**: A reviewer can read the spec and point to the facade, the service, the thin route, and the response envelope without opening runtime code changes.

**Acceptance Scenarios**:

1. **Given** a maintainer opens the package, **When** they look for the chat entrypoint, **Then** they can tell that `routes_sessions.py` stays thin and `chat_session_service.py` owns orchestration.
2. **Given** someone follows the naming note, **When** they inspect `chat_rag.py`, **Then** they can see whether the file should remain a compatibility facade, get renamed later, or be retired in a later cleanup.

---

### User Story 2 - Keep the public chat boundary safe

As a reviewer, I need the package to preserve the current public chat contract so it documents the existing `404` and `503` behavior without inventing new status codes or changing response shapes.

**Why this priority**: The chat route already has public-safe failure handling, and the docs should describe that exact shape instead of generalizing it away.

**Independent Test**: A reviewer can match the spec against the route and contract tests and see the same `404 Session not found` and safe `503` failures described in one place.

**Acceptance Scenarios**:

1. **Given** a missing session request, **When** the route fails, **Then** the package says the API returns `404 Session not found`.
2. **Given** a retrieval or chat dependency failure, **When** the route fails, **Then** the package says the response stays public-safe and terse, with no traceback or internal detail.

---

### User Story 3 - Leave a clear path for the later implementation slice

As a future implementer, I need the docs package to point at the later code-first path so the next step can clean up naming or retire the facade without reopening the route contract discussion.

**Why this priority**: The decision here is about naming and cleanup, not about changing chat behavior.

**Independent Test**: A reviewer can read the later path and see that the next implementation would stay inside the chat route, facade, and service seam, not expand into retrieval internals or a broader API rewrite.

**Acceptance Scenarios**:

1. **Given** someone wants to implement the cleanup later, **When** they read the follow-up note, **Then** they can see the exact files that should be revisited.
2. **Given** the docs package is used as planning context, **When** a future feature starts, **Then** it can keep the current chat contract unless a later spec explicitly changes it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package MUST document the current chat facade split as a docs-only R4 artifact.
- **FR-002**: The package MUST describe the live behavior of `routes_sessions.py`, `chat_rag.py`, and `chat_session_service.py` using observed repo behavior first.
- **FR-003**: The package MUST cover the current public chat boundary, including `ChatMessageEnvelope`, `404 Session not found`, and the safe `503` failure shapes.
- **FR-004**: The package MUST state the non-goals clearly, including no runtime refactor, no retrieval rewrite, and no chat contract change.
- **FR-005**: The package MUST include a later implementation path that points back to the chat route, facade, and service files.
- **FR-006**: The package MUST include verification anchors for placeholder scanning and a docs-only git diff check.
- **FR-007**: The package MUST stay narrow and MUST NOT expand into corpus, upload, queue, or broad API boundary work.

### Non-goals

- Change the current chat response shape.
- Redesign the route status codes.
- Rewrite retrieval behavior or citation logic.
- Replace the compatibility facade in runtime code now.
- Add new wiki pages unless a short pointer is truly needed.

### Later implementation path

The later code-first follow-up should start with the files that already own the boundary today: `apps/api/app/routes_sessions.py`, `apps/api/app/chat_rag.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/schemas.py`, and the route and contract tests that pin the current behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can read the package and identify the chat facade, the real orchestration owner, and the thin route boundary.
- **SC-002**: The package records the current `404` and safe `503` chat behavior without inventing new responses.
- **SC-003**: The scope stays docs-only and does not pull in runtime refactoring.
- **SC-004**: The package includes a clear later implementation path for the eventual code-first cleanup.
- **SC-005**: The changed markdown files pass placeholder scan and docs-only diff verification.

## Assumptions

- The current chat boundary is stable enough to document before any cleanup work starts.
- The wiki already contains the durable boundary notes, so this package only needs a short pointer if a page would otherwise repeat them.
- The next implementation feature will use these docs as planning context, not as a substitute for runtime verification.
