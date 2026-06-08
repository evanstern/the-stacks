# Implementation Plan: Chat Facade Cleanup or Naming Decision

**Branch**: `006-chat-facade-cleanup-or-naming-decision` | **Date**: 2026-06-08 | **Spec**: `/specs/006-chat-facade-cleanup-or-naming-decision/spec.md`

**Input**: Feature specification from `/specs/006-chat-facade-cleanup-or-naming-decision/spec.md`

## Summary

Create a docs-only Spec Kit package that captures the current chat facade split already visible in the backend. The package should keep the current `404` and safe `503` chat boundary visible, explain the thin route and the real orchestration owner, name the compatibility facade decision, and point later implementation work at the right files without changing runtime behavior now.

## Technical Context

**Language/Version**: Markdown Spec Kit artifacts, with the existing FastAPI backend as the documented target

**Primary Sources**: `docs/wiki/Chat Sessions Architecture.md`, `docs/wiki/API Refactor Roadmap.md`, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, `apps/api/app/chat_rag.py`, `apps/api/app/chat_session_service.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/schemas.py`, `apps/api/tests/test_chat_rag.py`, `apps/api/tests/test_contracts.py`, `apps/api/tests/test_sessions.py`

**Storage**: No storage changes

**Testing**: Placeholder scan on changed markdown and spec files, plus a git diff check limited to the docs package and any touched wiki or notepad files

**Target Platform**: The Stacks documentation worktree on Linux

**Project Type**: Docs-only planning artifact for a backend chat boundary decision

**Performance Goals**: Keep the package short, readable, and easy to reuse as planning context

**Constraints**: No runtime code, no migrations, no frontend work, no Docker or prod config changes, no chat contract change, and no broad wiki rewrite

**Scale/Scope**: One docs package, one R4 naming decision, one later implementation path

## Constitution Check

Pass. This feature stays inside the docs-only lane by documenting the observed chat boundary instead of changing it. The package is small enough to keep the facade decision readable without reopening the broader API boundary work.

## Project Structure

### Documentation (this feature)

```text
specs/006-chat-facade-cleanup-or-naming-decision/
├── spec.md
├── plan.md
└── tasks.md
```

### Supporting sources

```text
docs/wiki/
├── Chat Sessions Architecture.md
├── API Refactor Roadmap.md
├── Home.md
└── Layer Boundaries.md

apps/api/app/
├── chat_rag.py
├── chat_session_service.py
├── routes_sessions.py
└── schemas.py

apps/api/tests/
├── test_chat_rag.py
├── test_contracts.py
└── test_sessions.py
```

**Structure Decision**: Keep the package docs-only and let the later runtime feature handle any cleanup or rename in code. The wiki only needs a pointer if it would otherwise duplicate the durable boundary notes.

## Scope

In scope:

- Document the chat facade split that already exists in the codebase.
- Show the live route, facade, and service examples that support the naming decision.
- Record the non-goals and the later implementation path.
- Keep verification limited to placeholder scanning and docs-only diff checks.

Out of scope:

- Any runtime refactor.
- Retrieval behavior changes.
- Chat contract changes.
- New wiki pages unless a short pointer is truly needed.
- Upload, queue, corpus, or ETL scope expansion.

## Verification Strategy

- Scan changed markdown and spec files for unresolved placeholders.
- Check the final diff with `git diff -- specs/006-chat-facade-cleanup-or-naming-decision docs/wiki .omo/notepads/backend-phase-01-api-boundary`.
- Keep the change set docs-only.

## Risks

- The note could become too abstract if it leans on naming theory instead of current route behavior.
- A wiki pointer could become redundant if the existing spine already covers the needed path.
- The package could drift into implementation planning if the later path is described too broadly.

## Success Definition

This plan is successful when the new package clearly records the current chat facade split, shows the live examples, stays narrow, and leaves a clean handoff for the later code-first cleanup or rename.
