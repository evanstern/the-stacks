# Contract: API Architecture Review Report

## Purpose

The final review report must be structured enough for a maintainer to verify that the API-layer architecture sweep is complete, evidence-backed, and bounded to the requested scope.

## Required Sections

1. **Scope**
   - State that the review covers `apps/api/app`, API tests, and API-relevant wiki decisions.
   - State explicit non-goals: frontend UI, runtime behavior changes, migrations, new routes, and broad cross-layer rewrites.

2. **Evidence Inventory**
   - List wiki pages read.
   - List API modules inspected.
   - List test files or test groups inspected.

3. **Wiki Direction Summary**
   - Summarize the current layer boundaries from the wiki.
   - Identify any roadmap notes that affect API-layer planning.

4. **API Surface Map**
   - Include FastAPI app wiring.
   - Include route modules, prefixes, response models, dependencies, and major error shapes.

5. **Service and Pattern Map**
   - Describe route-thinness, dependency injection, service/facade boundaries, persistence ownership, metadata handling, and test seams.
   - Assess FastAPI-native practices: router grouping, shared dependencies, response models, HTTP error mapping, and dependency override testability.

6. **Findings**
   - Every finding must include:
     - category: `alignment`, `risk`, `inconsistency`, or `improvement`
     - severity: `high`, `medium`, or `low`
     - evidence references
     - affected files or seams
     - impact

7. **Recommendations**
   - Every recommendation must include:
     - priority
     - follow-up type: `documentation`, `refactor`, `contract/schema`, `test coverage`, or `future feature`
     - expected benefit
     - risk if deferred
     - verification anchor
     - wiki-impact decision

8. **Non-Goals and Deferred Work**
   - Identify anything discovered but intentionally excluded from this API-layer-only pass.

9. **Verification Evidence**
   - Include commands or checks used to validate the report structure and placeholder-free artifacts.

## Completeness Rules

- No finding may appear without evidence.
- No recommendation may require immediate runtime changes in this feature.
- Any wiki/code mismatch must be called out explicitly.
- The report must preserve lawful content, evidence traceability, operator control, and durable boundary constraints from the constitution.
