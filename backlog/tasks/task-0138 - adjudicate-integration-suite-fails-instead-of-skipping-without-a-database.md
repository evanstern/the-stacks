---
id: TASK-0138
title: adjudicate integration suite fails instead of skipping without a database
status: To Do
assignee: []
created_date: '2026-10-27 03:39'
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
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
