# Data Model: API Layer Architecture Review

## Overview

This feature models a review artifact, not runtime data. The entities below describe the information the final API architecture review must collect and report.

## Entities

### API Layer Review

- **Purpose**: The top-level review artifact that summarizes API-layer architecture alignment and improvement suggestions.
- **Fields**: title, date, scope, reviewer, evidence inventory, findings, recommendations, wiki-impact decision, verification evidence.
- **Relationships**: Contains many review findings and recommendations; references many wiki decisions and API route/service seams.
- **Validation rules**: Must state that the pass is review-only and must not claim runtime changes were implemented.

### Wiki Decision

- **Purpose**: A durable architecture statement from `docs/wiki/` that constrains API-layer direction.
- **Fields**: page path, section heading, decision summary, affected layer, current-state or roadmap status.
- **Relationships**: Can support or contradict one or more findings.
- **Validation rules**: Must include a concrete page reference; contradictions with code must be surfaced as review findings.

### API Route Surface

- **Purpose**: A FastAPI route module, endpoint group, or health/auth/session/upload/records/archive surface exposed by `apps/api/app`.
- **Fields**: module path, prefix, tag, endpoint purpose, dependencies, response model, error mapping behavior.
- **Relationships**: Invokes API service seams and emits API schema contracts.
- **Validation rules**: Must be limited to server/API behavior; frontend UI usage is not part of this entity.

### API Service Seam

- **Purpose**: A service, facade, adapter, helper, or persistence boundary used by route surfaces.
- **Fields**: module path, seam name, owned responsibility, dependencies, persistence side effects, test coverage anchor.
- **Relationships**: Supports one or more route surfaces; may implement a wiki decision.
- **Validation rules**: Must state whether the seam is route-owned, service-owned, host-owned, or layer-owned according to the wiki.

### Review Finding

- **Purpose**: Evidence-backed observation about API architecture, design, or pattern usage.
- **Fields**: category, title, evidence, affected seams, impact, severity, recommendation link.
- **Relationships**: References one or more wiki decisions, route surfaces, service seams, tests, or schemas.
- **Validation rules**: Category must be one of `alignment`, `risk`, `inconsistency`, or `improvement`.

### Recommendation

- **Purpose**: Suggested follow-up direction based on a finding.
- **Fields**: priority, suggested follow-up type, affected files, expected benefit, risk if deferred, verification anchor, wiki impact.
- **Relationships**: Belongs to one or more findings.
- **Validation rules**: Must not prescribe unbounded refactors; must identify whether the next step is documentation, refactor, contract/schema, test coverage, or future feature.

## Review State Flow

1. Collect wiki decisions.
2. Inventory API route surfaces and service seams.
3. Compare code patterns to wiki decisions and constitution constraints.
4. Record findings with evidence.
5. Convert findings into prioritized recommendations.
6. Record wiki-impact decision.
7. Verify the review against the output contract.

## Boundary Rules

- This feature does not add or change runtime database tables.
- This feature does not add API endpoints, migrations, schemas, or route behavior.
- Suggestions that require code changes must become separate future features.
