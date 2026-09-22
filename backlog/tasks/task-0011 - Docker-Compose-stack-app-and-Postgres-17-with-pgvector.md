---
id: TASK-0011
title: 'Docker Compose stack: app and Postgres 17 with pgvector'
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 15:22'
labels: []
milestone: m-0
dependencies:
  - TASK-0010
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the two-container compose stack from architecture A1: one Node app container and one Postgres 17 container with pgvector. Self-hosting is the distribution model, so 'docker compose up' working from a clean clone is a product requirement, not a convenience.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker compose up brings up app and db from a clean checkout
- [ ] #2 Postgres 17 runs with the pgvector extension available
- [ ] #3 Database data persists across container restarts via a named volume
- [ ] #4 Configuration is supplied by environment variables with a committed .env.example
- [ ] #5 The app container reaches the database and reports healthy
- [x] #6 Spec phase: Setup (Shared Infrastructure)
- [x] #7 Spec phase: Foundational (blocking prerequisites)
- [x] #8 Spec phase: User Story 1 — A stranger can run this project (P1)
- [x] #9 Spec phase: User Story 2 — An operator's data survives restarts and upgrades (P1)
- [x] #10 Spec phase: User Story 3 — The database is ready for what the project will need (P2)
- [x] #11 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec: specs/002-compose-stack

HELD 2026-09-22: Lane 2 paused before spec authoring. The runbook's per-task loop named the Spec Kit cycle as prose without binding it to the speckit-* skills, and spec 001 was hand-authored as a result. Runbook amendment in progress; spec authoring resumes against the amended loop.

Spec set complete via Spec Kit skills: spec.md, plan.md, tasks.md (26 tasks), research.md, data-model.md, quickstart.md, contracts/ (configuration, healthcheck), checklists/. 6 phase ACs seeded. Phases 1-2 dispatched.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

phases: 1-2 done (942db84, T001-T006). Verified by orchestrator: docker compose config parses (2 services, 1 named volume, exit 0); .gitignore extended not replaced; pgvector/pgvector:pg17 prebuilt per D4; runtime stage carries dist only. Phase 3 next. NOTE: first dispatch of this task landed in the wrong worktree (inherited orchestrator cwd) and correctly refused — see runbook amendment A2.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

phases: 1-3 done (942db84, 4592cbe, T001-T014). Healthcheck verified: healthcheck.js uses Node's built-in http (no curl in node:22-alpine), parses the body, exits 1 on degraded despite HTTP 200 — contract honored. CROSS-TASK DEFECT FOUND AND FIXED: contract defined APP_PORT only as the published host port; 002 probes APP_PORT, 003's server reads PORT. Contract now states APP_PORT is one number on both sides; TASK-0013 owes a one-line reconciliation.

SEQUENCING: T015-T017 (docker compose up convergence checks) require a running server, which TASK-0013 delivers. Lane 2's tasks are parallel through development but serial at the finish — 0013 merges first, then 0011's branch merges main in and runs its validation phase against a real /health. Recorded in tasks.md line 124 at spec time.

T015 PASS: both services healthy in ~15-20s from clean state incl. image build (SC-002 budget 2min). APP_PORT reconciliation held empirically — compose publishes, healthcheck.js probes, and config.ts reads the same variable. T016 FAIL: app container does not go unhealthy when db stops — it exits 1 in under a second, before the healthcheck can fire. Root cause is upstream of the healthcheck: missing pg.Pool error handler in apps/server/src/db.ts. Operator decision: fix + regression test on this branch, then re-run T016-T026.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

All 26 tasks done. T016 re-verified by orchestrator end to end after the pool fix: healthy -> db stopped -> app stays Up reporting degraded/HTTP 200 -> flips to (unhealthy) at ~54s -> db restarted -> healthy again, no manual app restart. Also fixed .dockerignore (bare *.tsbuildinfo missed nested files, breaking the build on any checkout where gates had run) and cleared 2 lint warnings this task introduced, including declaring APP_PORT/DATABASE_URL in turbo.json globalEnv for cache correctness.

spec-bridge sync: Setup (Shared Infrastructure): 2/2 · Foundational (blocking prerequisites): 4/4 · User Story 1 — A stranger can run this project (P1): 11/11 · User Story 2 — An operator's data survives restarts and upgrades (P1): 4/4 · User Story 3 — The database is ready for what the project will need (P2): 2/2 · Polish & Cross-Cutting Concerns: 3/3 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup (Shared Infrastructure): 2/2 · Foundational (blocking prerequisites): 4/4 · User Story 1 — A stranger can run this project (P1): 11/11 · User Story 2 — An operator's data survives restarts and upgrades (P1): 4/4 · User Story 3 — The database is ready for what the project will need (P2): 2/2 · Polish & Cross-Cutting Concerns: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
