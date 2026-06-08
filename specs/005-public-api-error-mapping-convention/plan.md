# Implementation Plan: Public API Error Mapping Convention

**Branch**: `005-public-api-error-mapping-convention` | **Date**: 2026-06-07 | **Spec**: `/specs/005-public-api-error-mapping-convention/spec.md`

**Input**: Feature specification from `/specs/005-public-api-error-mapping-convention/spec.md`

## Summary

Create a docs-only Spec Kit package that records the public API error-mapping convention already visible in the current backend routes and auth boundary. The package should stay narrow, list the live examples, explain the current `400`, `401`, `404`, `413`, `415`, and safe server-failure behavior, and point later implementation work toward the route and test files without changing runtime code now.

## Technical Context

**Language/Version**: Markdown Spec Kit artifacts, with the existing FastAPI backend as the documented target

**Primary Sources**: `docs/wiki/API Boundary Architecture.md`, `docs/wiki/API Refactor Roadmap.md`, `docs/wiki/Home.md`, `docs/wiki/Layer Boundaries.md`, `apps/api/app/auth.py`, `apps/api/app/routes_sessions.py`, `apps/api/app/routes_uploads.py`, `apps/api/app/routes_ingestion.py`, `apps/api/app/routes_records.py`, `apps/api/app/routes_archives.py`

**Storage**: No storage changes

**Testing**: Placeholder scan on changed markdown and spec files, plus a git diff check limited to the docs package and any touched wiki or notepad files

**Target Platform**: The Stacks documentation worktree on Linux

**Project Type**: Docs-only planning artifact for a backend API convention

**Performance Goals**: Keep the package short, readable, and easy to reuse as planning context

**Constraints**: No runtime code, no migrations, no frontend work, no Docker or prod config changes, no new error policy, and no broad wiki rewrite

**Scale/Scope**: One docs package, one R3 convention, one later implementation path

## Constitution Check

Pass. This feature stays inside the docs-only lane by documenting the observed API behavior instead of changing it. The package is small enough to keep the status-code convention readable without reopening the broader API boundary work.

## Project Structure

### Documentation (this feature)

```text
specs/005-public-api-error-mapping-convention/
├── spec.md
├── plan.md
└── tasks.md
```

### Supporting sources

```text
docs/wiki/
├── API Boundary Architecture.md
├── API Refactor Roadmap.md
├── Home.md
└── Layer Boundaries.md

apps/api/app/
├── auth.py
├── routes_sessions.py
├── routes_uploads.py
├── routes_ingestion.py
├── routes_records.py
└── routes_archives.py
```

**Structure Decision**: Keep the package docs-only and let the later runtime feature harden the convention in code. The wiki only needs a pointer if it would otherwise duplicate the durable boundary notes.

## Scope

In scope:

- Document the public error-mapping convention for the current API boundary.
- Show the live route examples that support the convention.
- Record the non-goals and the later implementation path.
- Keep verification limited to placeholder scanning and docs-only diff checks.

Out of scope:

- Any runtime refactor.
- Status-code redesign.
- New wiki pages unless a short pointer is truly needed.
- Upload, queue, chat, corpus, or ETL scope expansion.

## Verification Strategy

- Scan changed markdown and spec files for unresolved placeholders.
- Check the final diff with `git diff -- specs/005-public-api-error-mapping-convention docs/wiki .omo/notepads/backend-phase-01-api-boundary`.
- Keep the change set docs-only.

## Risks

- The note could become too abstract if it leans on HTTP theory instead of current route behavior.
- A wiki pointer could become redundant if the existing spine already covers the needed path.
- The package could drift into implementation planning if the later path is described too broadly.

## Success Definition

This plan is successful when the new package clearly records the current public error convention, shows the live examples, stays narrow, and leaves a clean handoff for the later code-first follow-up.
