---
id: TASK-0098
title: Runtime stacks come up with an unmigrated app database
status: Done
assignee: []
created_date: '2026-10-26 02:58'
updated_date: '2026-11-09 05:58'
labels:
  - env
  - runtime
  - 'ws:platform'
milestone: m-10
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: pnpm env:up and pnpm env:main bring up a stack whose app database is migrated, with no manual db:migrate step.

Why: reproduced 2026-10-26 with pnpm env:main. The main stack came up healthy (/health ok, database reachable) but had no tables (relation "users" does not exist) until db:migrate was run by hand from the host against localhost:5432 with the stack's POSTGRES_PASSWORD. An implementer reported the same gap for pnpm env:up during TASK-0043. A healthy check over an empty schema hides the gap. Raised in the M2 First Scene sweep; carded by operator ruling 2026-10-26. Outside M2 scope. Reference: specs/010-worktree-stacks/contracts/env-cli.md.

Spec: specs/095-migrated-stacks
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm env:up leaves the worktree's app database migrated to the branch's latest migration.
- [x] #2 pnpm env:main leaves the main stack's app database migrated to origin/main's latest migration.
- [x] #3 A test or scripted check fails when a stack comes up with an unmigrated app database.
- [x] #4 The env-cli contract documents where migration happens.
- [x] #5 Phase 1: migrate on up, verify, back off (specs/095 tasks.md T001-T010)
- [x] #6 Phase 2: wiki re-ground (specs/095 tasks.md T011-T015)
- [x] #7 Spec phase: Migrate on up, verify, back off (US1, US2, US3; FR-001 to FR-010)
- [x] #8 Spec phase: Wiki (re-ground)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Finding 2026-10-26 (M2 sweep orchestrator, TASK-0048 stack): (1) The documented hand workaround is wrong. apps/server/scripts/migrate.ts prefers TEST_DATABASE_URL over DATABASE_URL, and node --env-file loads the worktree .env, which sets TEST_DATABASE_URL. So 'DATABASE_URL=<app url> pnpm --filter @the-stacks/server db:migrate' silently migrates the TEST database. To migrate the app DB, pass the app URL as TEST_DATABASE_URL. (2) On an unmigrated stack, the ingest worker's loop logs 'relation "jobs" does not exist' in a tight loop with no backoff: about 2,000 errors in a few seconds. A missing schema should stop the worker or back it off. Both belong in this card's fix.

Finding 2026-10-26 (M2 demo prep): apps/server/src/cli/create-operator.ts has the same precedence as migrate.ts (TEST_DATABASE_URL || config.databaseUrl). On a host worktree whose .env sets TEST_DATABASE_URL, 'pnpm --filter @the-stacks/server auth:create-operator' creates the operator in the TEST database, and the app has no operator. Workaround: pass the app DB URL as TEST_DATABASE_URL. The fix should give host CLIs an explicit target for the app DB.

Observed 2026-10-27 (TASK-0049 Phase 3): on a worktree stack the app DB and the test DB use different credentials. Migrating the app DB needs the app container's DATABASE_URL with its host swapped to localhost:<db port>. The test-db credentials fail with CREATE SCHEMA drizzle.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0098, branch task-0098-migrated-stacks, cut from origin/main a8bda4ab. Spec number 095 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 095 committed (0300bd09). Phase ACs seeded from tasks.md. OQ1 (no explicit-target flag; document in-container create-operator) and OQ3 (/health unchanged) adopted as recommended. OQ2 (self-hoster docker compose up is unmigrated) carded separately.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
Phases 1-2 done (3510dac3, fb90d5de). env:up migrated both DBs to 10/10 journal entries; REQUIRE_DATABASE=1 pnpm ci:check exited 0 with nothing skipped (implementer). Orchestrator re-check: freshness OK 60 notes, plan empty, env:prune --check exit 0. PR held: spine #6, after 0266, 0273, 0270.

spec-bridge sync: Migrate on up, verify, back off (US1, US2, US3; FR-001 to FR-010): 10/10 · Wiki (re-ground): 5/5 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Migrate on up, verify, back off (US1, US2, US3; FR-001 to FR-010): 10/10 · Wiki (re-ground): 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
