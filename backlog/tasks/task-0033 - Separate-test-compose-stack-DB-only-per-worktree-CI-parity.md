---
id: TASK-0033
title: 'Separate test compose stack: DB-only, per worktree, CI parity'
status: Done
assignee: []
created_date: '2026-09-29 18:37'
updated_date: '2026-09-29 19:54'
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

Spec: specs/020-test-compose
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A docker-compose.test.yml defines a DB-only stack with no app service, and its data is throwaway (tmpfs, no named volume)
- [ ] #2 The Postgres/pgvector image is pinned in exactly one place, shared by docker-compose.yml, the test compose file, and CI
- [ ] #3 env:up (or a sibling verb) brings up the test stack as stacks-task-<n>-test on its own port range, with the org.the-stacks.* labels, and writes TEST_DATABASE_URL pointing at it
- [ ] #4 env:down and env:prune --check cover the test stack; an orphaned test stack is reported like any other
- [ ] #5 worker.integration.test.ts passes 20 consecutive local runs with the app stack up
- [ ] #6 The runtime-stacks and test-suite wiki notes and .env.example document the split
- [x] #7 Spec phase: Foundational — derivation and the test compose file
- [x] #8 Spec phase: US2 — CI parity (Priority: P1)
- [x] #9 Spec phase: US1 + US3 — env machinery (Priority: P1/P2)
- [x] #10 Spec phase: US4 — documentation (Priority: P3)
- [x] #11 Spec phase: Verification, re-grounding, cleanup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~159k tokens). Plan flags 3 operator items (CI services->compose step; host db:migrate targets the test DB; '-test' worktree suffix reserved) — put to operator before implementation dispatch.

Operator rulings 2026-09-29 (plan checkpoint): (1) CI drops services: for docker compose -f docker-compose.test.yml up -d --wait; (2) host pnpm db:migrate targets the test DB, app-DB override documented in .env.example and runtime-stacks; (3) worktree names ending in -test are reserved; env:up refuses them. Phase grouping: P1 alone; P2+P3; P4+P5.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 1: env-lib derivation + docker-compose.test.yml extends; 35 env-lib tests). Deviation accepted: T005 image-pin guard moved into the phase 2 dispatch (it goes green only after T007 removes ci.yml's services: block); no gate softened.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 2-3 + T005: ci.yml -> compose test stack; env:up/down handle both stacks; image-pin guard; real up/test(302 pass)/down/prune proof). Orchestrator verified: no .claude/ changes on the branch.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 4-5: docs incl. db:migrate override; AC #5 proof 20/20 worker.integration with app stack up; 5 NEEDS-REVIEW + 3 RE-PIN-ONLY wiki notes; freshness OK 34). T017 check:env e2e self-skipped because TASK-0027's stack was up; the orchestrator will run it when no other stack is up, before the PR leaves draft.

spec-bridge sync: Foundational — derivation and the test compose file: 6/6 · US2 — CI parity (Priority: P1): 2/2 · US1 + US3 — env machinery (Priority: P1/P2): 5/5 · US4 — documentation (Priority: P3): 2/2 · Verification, re-grounding, cleanup: 7/7 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Foundational — derivation and the test compose file: 6/6 · US2 — CI parity (Priority: P1): 2/2 · US1 + US3 — env machinery (Priority: P1/P2): 5/5 · US4 — documentation (Priority: P3): 2/2 · Verification, re-grounding, cleanup: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
