---
id: TASK-8
title: Isolate DB-gated test suites from each other
status: Done
assignee:
  - '@claude'
created_date: '2026-07-10 20:46'
updated_date: '2026-07-10 22:41'
labels:
  - testing
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm -r run test executes up to four package suites concurrently against the single DATABASE_URL Postgres; apps/api's migration-lifecycle suite resets schema while apps/worker's ingest-pipeline e2e is mid-flight (FK violations, 'unknown batch' — flaked on the-stacks PR #8 CI, run 29122326255). CI currently serializes with npm_config_workspace_concurrency=1 (ci.yml verify job); the durable fix is per-suite isolation: a schema or database per package suite, or a lock around the migration-lifecycle test.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Durable fix implemented: ensureSuiteDatabase/deriveSuiteDatabaseUrl in @stacks/db (packages/db/src/test-db.ts, TDD — pure derivation unit-tested, integration test DB-gated like its peers). All 11 shared-URL suites wired to unique per-file suite databases (migration-lifecycle keeps its own MIGRATION_TEST_DATABASE_URL scratch mechanism). Root cause was cross-package beforeEach TRUNCATE...CASCADE races, not the migration suite (it already self-isolates and skips in CI). Serialization stopgap removed from pnpm verify — test leg parallel again; 3 consecutive full DB-backed verify runs green; 12 per-suite databases confirmed in the compose Postgres. Wiki pins unaffected (test files aren't note sources). 0.1.3→0.1.4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Per-suite test databases in @stacks/db (ensureSuiteDatabase, TDD'd): all 11 shared-URL DB-gated suites derive unique per-file databases from DATABASE_URL — cross-suite TRUNCATE contamination structurally impossible. Root cause was cross-package beforeEach truncation, not the (already-isolated) migration-lifecycle suite. Serialization stopgap removed from pnpm verify; 3 consecutive parallel DB-backed runs green locally + CI green in the exact config that flaked. Merged via PR #12, released as v0.1.4.
<!-- SECTION:FINAL_SUMMARY:END -->
