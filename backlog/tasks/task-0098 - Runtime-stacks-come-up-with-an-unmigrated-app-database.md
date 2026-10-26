---
id: TASK-0098
title: Runtime stacks come up with an unmigrated app database
status: To Do
assignee: []
created_date: '2026-10-26 02:58'
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
