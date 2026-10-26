---
id: TASK-0098
title: Runtime stacks come up with an unmigrated app database
status: To Do
assignee: []
created_date: '2026-10-26 02:58'
updated_date: '2026-10-26 20:26'
labels:
  - env
  - runtime
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: pnpm env:up and pnpm env:main bring up a stack whose app database is migrated, with no manual db:migrate step.

Why: reproduced 2026-10-26 with pnpm env:main. The main stack came up healthy (/health ok, database reachable) but had no tables (relation "users" does not exist) until db:migrate was run by hand from the host against localhost:5432 with the stack's POSTGRES_PASSWORD. An implementer reported the same gap for pnpm env:up during TASK-0043. A healthy check over an empty schema hides the gap. Raised in the M2 First Scene sweep; carded by operator ruling 2026-10-26. Outside M2 scope. Reference: specs/010-worktree-stacks/contracts/env-cli.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm env:up leaves the worktree's app database migrated to the branch's latest migration.
- [ ] #2 pnpm env:main leaves the main stack's app database migrated to origin/main's latest migration.
- [ ] #3 A test or scripted check fails when a stack comes up with an unmigrated app database.
- [ ] #4 The env-cli contract documents where migration happens.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Finding 2026-10-26 (M2 sweep orchestrator, TASK-0048 stack): (1) The documented hand workaround is wrong. apps/server/scripts/migrate.ts prefers TEST_DATABASE_URL over DATABASE_URL, and node --env-file loads the worktree .env, which sets TEST_DATABASE_URL. So 'DATABASE_URL=<app url> pnpm --filter @the-stacks/server db:migrate' silently migrates the TEST database. To migrate the app DB, pass the app URL as TEST_DATABASE_URL. (2) On an unmigrated stack, the ingest worker's loop logs 'relation "jobs" does not exist' in a tight loop with no backoff: about 2,000 errors in a few seconds. A missing schema should stop the worker or back it off. Both belong in this card's fix.

Finding 2026-10-26 (M2 demo prep): apps/server/src/cli/create-operator.ts has the same precedence as migrate.ts (TEST_DATABASE_URL || config.databaseUrl). On a host worktree whose .env sets TEST_DATABASE_URL, 'pnpm --filter @the-stacks/server auth:create-operator' creates the operator in the TEST database, and the app has no operator. Workaround: pass the app DB URL as TEST_DATABASE_URL. The fix should give host CLIs an explicit target for the app DB.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
