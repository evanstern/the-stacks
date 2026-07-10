---
id: TASK-8
title: Isolate DB-gated test suites from each other
status: To Do
assignee: []
created_date: '2026-07-10 20:46'
labels:
  - testing
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pnpm -r run test executes up to four package suites concurrently against the single DATABASE_URL Postgres; apps/api's migration-lifecycle suite resets schema while apps/worker's ingest-pipeline e2e is mid-flight (FK violations, 'unknown batch' — flaked on the-stacks PR #8 CI, run 29122326255). CI currently serializes with npm_config_workspace_concurrency=1 (ci.yml verify job); the durable fix is per-suite isolation: a schema or database per package suite, or a lock around the migration-lifecycle test.
<!-- SECTION:DESCRIPTION:END -->
