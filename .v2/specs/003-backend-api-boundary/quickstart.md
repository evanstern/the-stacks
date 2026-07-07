# Quickstart: API Boundary Hardening for Session Messages

## What this feature is for

Use this Spec Kit bundle to harden the session message boundary in runtime code and tests. The goal is to keep `POST /sessions/{session_id}/messages` thin, keep the service seam explicit, and make the public contract easy to verify.

## Scope

In scope:

- `apps/api/app/routes_sessions.py`
- `apps/api/app/chat_session_service.py`
- `apps/api/app/schemas.py`
- `apps/api/tests/test_sessions.py`
- `apps/api/tests/test_chat_rag.py`
- `apps/api/tests/test_contracts.py`
- Supporting notes in `.omo/notepads/backend-phase-01-api-boundary/learnings.md`

Out of scope:

- Broad route refactors outside the session message boundary
- Database migrations
- Frontend changes
- New docs/wiki pages as the main deliverable

## Read order

1. `specs/003-backend-api-boundary/spec.md`
2. `specs/003-backend-api-boundary/research.md`
3. `specs/003-backend-api-boundary/data-model.md`
4. `specs/003-backend-api-boundary/plan.md`
5. `specs/003-backend-api-boundary/tasks.md`
6. `apps/api/app/routes_sessions.py`
7. `apps/api/app/chat_session_service.py`
8. `apps/api/app/schemas.py`
9. `apps/api/tests/test_contracts.py`
10. `apps/api/tests/test_chat_rag.py`
11. `apps/api/tests/test_sessions.py`

## What a reviewer should check

- The route stays thin and delegates the session message workflow to the service seam.
- The route preserves the public `ChatMessageEnvelope` contract.
- Missing sessions and expected collaborator failures map to stable public errors.
- Test coverage uses named dependency seams and `app.dependency_overrides`.
- The companion session read path is only included if it helps keep the message boundary coherent.

## Validation commands

Run these from the repository root to confirm the package is code-first and internally consistent:

```bash
rg -n "POST /sessions/\{session_id\}/messages|ChatMessageEnvelope|dependency_overrides|Session not found|503|500" specs/003-backend-api-boundary apps/api/app apps/api/tests
```

```bash
rg -n "wiki|docs/wiki|preflight|postflight" specs/003-backend-api-boundary
```

```bash
sed -n '1,220p' specs/003-backend-api-boundary/spec.md
sed -n '1,220p' specs/003-backend-api-boundary/research.md
sed -n '1,220p' specs/003-backend-api-boundary/data-model.md
```

## Expected review result

The bundle should read like an implementation brief for hardening the session message API boundary. A reviewer should be able to move from the spec package into the runtime route, service, schemas, and tests without first needing more wiki work.
