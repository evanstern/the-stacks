---
id: TASK-0138
title: adjudicate integration suite fails instead of skipping without a database
status: To Do
assignee: []
created_date: '2026-10-27 03:39'
updated_date: '2026-11-02 05:22'
labels:
  - test
  - bug
  - server
milestone: m-3
dependencies: []
priority: medium
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: apps/server/test/dm/adjudicate.integration.test.ts skips without a reachable database, like every other *.integration.test.ts, and runs under REQUIRE_DATABASE=1. Evidence: M3 sweep TASK-0118 dispatch 2026-10-26: pnpm ci:check fails locally with no stack up, 5 tests throwing 'adjudicate integration tests require a database' (requireDb at line 40, setup at line 74), while the other integration suites skip ('no reachable database'). Pre-existing on main; CI has a database, so CI stays green. Every web-only or docs-only branch hits it locally (docs/wiki/test-suite.md, the skip trap).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With no reachable database and REQUIRE_DATABASE unset, the suite reports skipped, not failed
- [ ] #2 With REQUIRE_DATABASE=1 and no database, the suite fails loudly, as the other suites do
- [ ] #3 The adjudicate describe block uses describe.skipIf(!reachable) like jobs.integration.test.ts (merged from TASK-0185)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-02: merged duplicate TASK-0185 into this card (same file, same missing no-DB skip; found again in TASK-0180 Phase 1, 2026-10-30). Its pattern criterion is added here as AC #3; its 'ci:check skips the 5 tests' criterion is covered by AC #1.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
