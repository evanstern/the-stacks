# Implementation Plan: API Boundary Hardening for Session Messages

**Branch**: `003-backend-api-boundary` | **Date**: 2026-06-07 | **Spec**: `/specs/003-backend-api-boundary/spec.md`

**Input**: Feature specification from `/specs/003-backend-api-boundary/spec.md`

## Summary

Harden the session message API boundary in runtime code and tests. The implementation slice centers on `POST /sessions/{session_id}/messages`, keeps the route thin, keeps `apps/api/app/chat_session_service.py` as the workflow seam, preserves the public `ChatMessageEnvelope` contract, and uses named FastAPI dependency seams so tests can override collaborators cleanly. Include the companion session read path only if it is needed to keep the boundary coherent.

## Technical Context

**Language/Version**: Markdown spec package, with existing FastAPI/Python runtime code as the implementation target

**Primary Dependencies**: `apps/api/app/routes_sessions.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/schemas.py`, `apps/api/tests/test_sessions.py`, `apps/api/tests/test_chat_rag.py`, `apps/api/tests/test_contracts.py`, `.omo/notepads/backend-phase-01-api-boundary/learnings.md`

**Storage**: No new storage changes

**Testing**: Focused route and service tests with `TestClient`, dependency overrides, and public contract assertions; no docs-only validation as the primary gate

**Target Platform**: The Stacks backend API worktree on Linux

**Project Type**: Web-service backend feature with runtime route and test hardening

**Performance Goals**: Keep the route path thin and keep test isolation fast enough that the boundary can be verified without live external services

**Constraints**: No broad API refactor, no database migrations, no frontend work, no new wiki-first deliverable, preserve current public session-message error shapes unless tests show a narrow correction is needed, and keep the scope centered on the session message boundary

**Scale/Scope**: One route boundary, one service seam, one public response contract, and the tests that lock them

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pass. This work stays inside the project constraints by keeping the feature code-first, narrowing the slice to the session message boundary, preserving the current public API contract, and avoiding unrelated route or schema refactors. The runtime work can be verified with focused tests rather than docs-only checks.

## Project Structure

### Documentation (this feature)

```text
specs/003-backend-api-boundary/
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── plan.md
└── tasks.md
```

### Source Code (implementation target)

```text
apps/api/app/
├── routes_sessions.py
├── chat_session_service.py
└── schemas.py

apps/api/tests/
├── test_sessions.py
├── test_chat_rag.py
└── test_contracts.py
```

**Structure Decision**: This is a runtime hardening feature. The implementation should stay focused on the session message route-to-service seam and the tests that prove the boundary. Supporting docs and wiki notes may remain in the background, but they are not the feature output.

## Complexity Tracking

Not applicable. The slice is intentionally narrow, and the work is about locking an already existing boundary rather than inventing a new architecture layer.
