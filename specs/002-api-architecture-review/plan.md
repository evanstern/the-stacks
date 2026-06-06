# Implementation Plan: API Layer Architecture Review

**Branch**: `[002-api-architecture-review]` | **Date**: 2026-06-06 | **Spec**: `specs/002-api-architecture-review/spec.md`

**Input**: Feature specification from `/specs/002-api-architecture-review/spec.md`

**Note**: This plan creates a review/design artifact set only. It does not authorize runtime API changes, route changes, migrations, schema changes, frontend work, or broad cross-layer refactors.

## Summary

Prepare a full API-layer architecture review that starts from the durable wiki direction, maps current FastAPI route and service patterns, and defines a verifiable output contract for evidence-backed improvement suggestions. The API layer is treated as `apps/api/app` plus API tests and API-relevant wiki decisions. Findings must be categorized, evidence-backed, and scoped into future follow-up work rather than implemented during this pass.

## Technical Context

**Language/Version**: Python 3.11 for the API layer

**Primary Dependencies**: FastAPI, Pydantic, SQLAlchemy, PostgreSQL, Qdrant, pytest, Docker Compose

**Storage**: PostgreSQL models in `apps/api/app/models.py`; Qdrant indexing through `apps/api/app/qdrant_index.py`; no new storage for this review

**Testing**: `make test` from `main/`, focused pytest under `apps/api/tests`, and documentation/contract grep checks for review artifacts

**Target Platform**: Linux development and deployment worktrees backed by the existing compose stack

**Project Type**: Web service API review/design feature

**Performance Goals**: Not applicable for this planning pass; recommendations may flag future performance concerns, but no throughput target is introduced here

**Constraints**: API-layer-only review; wiki-grounded; evidence-backed; no runtime behavior changes; no frontend UI work; no schema/API/migration/refactor implementation in this feature

**Scale/Scope**: One bounded API review feature covering FastAPI app wiring, routers, schemas, models, service seams, test evidence, and relevant wiki decisions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pass.

- Lawful operator-supplied content boundaries are preserved because this pass only reviews API architecture and does not add sources, scraping, bundled data, or fixtures.
- Contract-first ETL and retrieval are respected by requiring the review to start from `docs/wiki/` contracts and cite API route/service/schema evidence before recommending changes.
- Evidence-labeled intelligence is respected by requiring each finding and recommendation to include evidence references and by distinguishing review analysis from retrieved/source-backed claims.
- Operator control and auditability are preserved because this pass introduces no destructive runtime operations and requires future work to identify verification and wiki-impact expectations.
- Durable architecture boundaries are central to the feature: the review must compare API patterns against the wiki, record mismatches, and avoid crossing into frontend, ETL, retrieval, corpus, chat, or queue internals except at API seams.

## Project Structure

### Documentation (this feature)

```text
specs/002-api-architecture-review/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── review-report.md
```

### Source Code (repository root)

```text
apps/api/app/
├── main.py
├── routes_auth.py
├── routes_archives.py
├── routes_ingestion.py
├── routes_records.py
├── routes_sessions.py
├── routes_uploads.py
├── schemas.py
├── models.py
├── auth.py
├── ingestion.py
├── retrieval_service.py
├── chat_session_service.py
├── chat_rag.py
├── chat_citations.py
├── corpus_seed.py
├── corpus_reset.py
├── corpus_manifest.py
├── version_lifecycle.py
├── embeddings.py
├── qdrant_index.py
└── etl/
    ├── contracts.py
    ├── runner.py
    ├── load_services.py
    ├── bundled.py
    └── ingestion_compat.py

apps/api/tests/
└── test_*.py

docs/wiki/
├── Home.md
├── Layer Boundaries.md
├── ETL Architecture.md
├── ETL Plugin Contracts.md
├── LangGraph ETL Decision.md
├── RAG Retrieval Architecture.md
├── Corpus Management Architecture.md
├── Chat Sessions Architecture.md
└── Queue Architecture.md
```

**Structure Decision**: The feature artifacts live under `specs/002-api-architecture-review/`. The review target is the existing API layer under `apps/api/app`, with API tests and wiki pages as evidence inputs. No source-code directory is created or modified by this planning pass.

## Phase 0: Research Summary

Research output is recorded in `research.md`.

- The active Spec Kit setup initially resolved to `specs/001-live-db-backed-queue`, so this API review was split into a separate feature to avoid overwriting queue artifacts.
- The review must ingest the wiki spine before assessing code because the constitution and `docs/wiki/Home.md` define wiki pages as durable architecture direction.
- The review scope includes route modules, service seams, schemas, models, dependencies, error mapping, metadata sanitization, and tests because API architecture is distributed across those files.
- The final review needs an explicit output contract so findings and recommendations can be verified without relying on subjective prose.

## Phase 1: Design Summary

Design output is recorded in `data-model.md`, `contracts/review-report.md`, and `quickstart.md`.

- `data-model.md` models the review artifact, wiki decisions, API route surfaces, service seams, findings, and recommendations.
- `contracts/review-report.md` defines the required final review structure and completeness rules.
- `quickstart.md` gives the read order and validation commands for executing the review later.

## Post-Design Constitution Check

Pass.

- The design artifacts preserve the review-only boundary.
- The output contract requires evidence for every finding and recommendation.
- The review contract requires a wiki-impact decision for future work.
- The quickstart validation commands are read-only and do not mutate runtime state.

## Complexity Tracking

None. The feature stays within documentation, planning, and review artifacts.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
