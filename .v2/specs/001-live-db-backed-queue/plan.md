# Implementation Plan: Live DB-backed Queue Claim/Status Handling

**Branch**: `[001-live-db-backed-queue]` | **Date**: 2026-06-06 | **Spec**: `specs/001-live-db-backed-queue/spec.md`

**Input**: Feature specification from `/specs/001-live-db-backed-queue/spec.md`

**Note**: This plan captures the current DB-backed queue boundary only. It keeps the scope aligned to the live claim/status flow documented in the wiki and excludes a brokered queue redesign, retry or cancel controls, admin dashboards, and ETL/chat/corpus ownership changes.

## Summary

Document the current queue boundary as live DB-backed claim/status handling so future planning stays tied to what the system does today. The implementation work for this pass is documentation only: the queue state lives in ordinary database rows, workers claim jobs with row locking, batch status is derived from persisted child job status, and the plan must not imply a new brokered queue architecture.

## Technical Context

**Language/Version**: Python 3.11 in the API and worker stack, with TypeScript only for the web app already present in the repo

**Primary Dependencies**: FastAPI, SQLAlchemy, PostgreSQL, pytest, Docker Compose

**Storage**: PostgreSQL for `UploadBatch`, `Upload`, `IngestionJob`, and `IngestionEvent` rows; no new storage layer for this plan

**Testing**: `make test` from `main/` and focused backend pytest runs, with Docker as the fallback when host pytest is unavailable

**Target Platform**: Linux development and deployment worktrees backed by the existing compose stack

**Project Type**: Web service with backend worker processes and a separate frontend, but this plan only documents the backend queue boundary

**Performance Goals**: Preserve the existing worker polling and claim flow; no new throughput target is introduced by this documentation pass

**Constraints**: Keep the scope to current DB-backed claim/status behavior, keep the wiki and live code as source of truth, and avoid broker semantics or ownership shifts

**Scale/Scope**: One current queue boundary, one set of operator-facing status rows, and one canonical feature directory under `specs/001-live-db-backed-queue/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pass.

- The work is documentation and planning only, so it does not weaken lawful content boundaries or mutate runtime data contracts.
- The plan keeps the current live queue boundary described as a DB-backed claim/status flow, which matches the durable architecture boundary already recorded in `main/docs/wiki/Layer Boundaries.md` and `main/docs/wiki/Queue Architecture.md`.
- The work does not add hidden fallback behavior, new retry or cancel semantics, or a new queue subsystem that would need a durable architecture decision.
- The durable boundary remains in the wiki; this pass records the plan and the supporting artifacts, not a new settled architecture rule.

## Project Structure

### Documentation (this feature)

```text
specs/001-live-db-backed-queue/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Canonical feature spec for the live queue boundary
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
main/apps/api/app/ingestion.py
main/apps/api/app/models.py
main/apps/api/app/routes_uploads.py
main/apps/api/app/routes_ingestion.py
main/apps/api/app/etl/runner.py
main/apps/worker/worker.py
main/docs/wiki/Layer Boundaries.md
main/docs/wiki/Queue Architecture.md
```

**Structure Decision**: This feature is documentation only and lives in `specs/001-live-db-backed-queue/`. The supporting code already exists in `main/apps/api/app/` and `main/apps/worker/`, so the plan points at the live backend seams instead of introducing new source modules. No `contracts/` directory is needed because this pass does not define a new external interface.

## Complexity Tracking

None. The plan stays within the existing architecture and only documents the current queue boundary.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
