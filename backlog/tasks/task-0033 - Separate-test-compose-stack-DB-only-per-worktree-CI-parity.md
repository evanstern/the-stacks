---
id: TASK-0033
title: 'Separate test compose stack: DB-only, per worktree, CI parity'
status: To Do
assignee: []
created_date: '2026-09-29 18:37'
labels:
  - infra
  - test
milestone: m-1
dependencies:
  - TASK-0021
  - TASK-0024
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-29 on TASK-0024 (#31): the per-worktree stack's app container runs the ingest worker against the same jobs table the tests use, claims test-enqueued jobs, and fails them (it cannot see the host upload path). worker.integration T023 flaked ~10-15% locally; CI (bare pgvector service, no app) cannot hit it. Operator ruling 2026-09-29: isolate tests with a separate test compose file rather than a second database in the prod-like compose. The app stack stays purely 'run the app'; tests get a DB-only, throwaway stack that mirrors CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A docker-compose.test.yml defines a DB-only stack with no app service, and its data is throwaway (tmpfs, no named volume)
- [ ] #2 The Postgres/pgvector image is pinned in exactly one place, shared by docker-compose.yml, the test compose file, and CI
- [ ] #3 env:up (or a sibling verb) brings up the test stack as stacks-task-<n>-test on its own port range, with the org.the-stacks.* labels, and writes TEST_DATABASE_URL pointing at it
- [ ] #4 env:down and env:prune --check cover the test stack; an orphaned test stack is reported like any other
- [ ] #5 worker.integration.test.ts passes 20 consecutive local runs with the app stack up
- [ ] #6 The runtime-stacks and test-suite wiki notes and .env.example document the split
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
