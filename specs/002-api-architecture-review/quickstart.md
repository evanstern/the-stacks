# Quickstart: API Layer Architecture Review

## What this feature is for

Use this Spec Kit bundle to execute a review of API-layer architecture, decisions, design, and pattern usage. The review must ingest the wiki first, then compare the API layer against that direction and produce scoped suggestions for improvement.

## Scope

In scope:

- `docs/wiki/` architecture pages
- `apps/api/app/` FastAPI app, routers, schemas, models, services, adapters, and dependencies
- `apps/api/tests/` API-layer test evidence

Out of scope:

- Frontend UI implementation
- Runtime behavior changes
- Database migrations
- New API endpoints
- Broad cross-layer refactors

## Read order

1. `specs/002-api-architecture-review/spec.md`
2. `specs/002-api-architecture-review/research.md`
3. `specs/002-api-architecture-review/data-model.md`
4. `specs/002-api-architecture-review/contracts/review-report.md`
5. `docs/wiki/Home.md`
6. `docs/wiki/Layer Boundaries.md`
7. The remaining linked wiki architecture pages

## Validation commands

From `main/`, confirm this feature resolves independently from the queue feature:

```bash
SPECIFY_FEATURE=002-api-architecture-review SPECIFY_FEATURE_DIRECTORY=specs/002-api-architecture-review bash .specify/scripts/bash/setup-plan.sh --json
```

Confirm generated artifacts have no unresolved placeholders:

```bash
rg -n "NEEDS CLARIFICATION|TBD|\[FEATURE|\[###" specs/002-api-architecture-review --glob '!quickstart.md'
```

List API route and service seams for the review executor:

```bash
rg -n "APIRouter|include_router|response_model|Depends\(|HTTPException|^class |^def " apps/api/app
```

List API tests that exercise dependency overrides and route/service seams:

```bash
rg -n "dependency_overrides|get_db|response_model|RetrievalService|answer_session_message|HTTPException" apps/api/tests
```

List wiki architecture anchors:

```bash
rg -n "architecture|boundary|contract|decision|owns|does not own|roadmap" docs/wiki
```

## Expected review output

The final review should satisfy `contracts/review-report.md`. It should be a report or follow-up plan, not a code change. If it identifies implementation work, create separate bounded specs or tasks.
