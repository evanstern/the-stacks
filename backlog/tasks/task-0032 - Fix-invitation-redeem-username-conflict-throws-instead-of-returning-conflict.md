---
id: TASK-0032
title: 'Fix invitation redeem: username conflict throws instead of returning conflict'
status: To Do
assignee: []
created_date: '2026-09-29 05:35'
labels:
  - bug
  - auth
dependencies: []
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-29 during TASK-0022. apps/server/src/auth/invitations.ts isUniqueViolation() checks only err.code, but drizzle-orm wraps driver errors in DrizzleQueryError with the pg error on err.cause. So redeeming an invitation with a taken username throws a 500 instead of returning {ok:false, reason:'conflict'}. TASK-0022 fixed the same helper in apps/server/src/library/store.ts (commit 83ebc51) by also checking err.cause.code. Share one helper instead of two copies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Redeeming an invitation with an already-taken username returns reason conflict, proven by an integration test against a real database
- [ ] #2 One shared unique-violation helper serves auth and library; no duplicate copies remain
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
