---
id: TASK-0032
title: 'Fix invitation redeem: username conflict throws instead of returning conflict'
status: Done
assignee: []
created_date: '2026-09-29 05:35'
updated_date: '2026-09-29 15:53'
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

Spec: specs/014-invite-conflict
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Redeeming an invitation with an already-taken username returns reason conflict, proven by an integration test against a real database
- [x] #2 One shared unique-violation helper serves auth and library; no duplicate copies remain
- [x] #3 Spec phase: Failing tests first
- [ ] #4 Spec phase: One shared helper and the fix (US1 + US2)
- [ ] #5 Spec phase: Gates and grounding
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~147k tokens)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 1-2, ~139k tokens; fail->pass proven, 36/36 with REQUIRE_DATABASE=1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 3 gates+wiki, ~136k tokens). Follow-up for triage: docs/wiki/test-suite.md pins only 11 of 22 server test files (ai, library, ddb suites from wave 1 are unlisted); pre-existing, out of 0032 scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Failing tests first: 4/4 · One shared helper and the fix (US1 + US2): 5/5 · Gates and grounding: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
