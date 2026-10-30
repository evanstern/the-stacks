---
id: TASK-0185
title: adjudicate integration test lacks its no-database skip guard
status: To Do
assignee: []
created_date: '2026-10-30 15:19'
labels:
  - test
  - dm
milestone: m-3
dependencies: []
priority: low
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: apps/server/test/dm/adjudicate.integration.test.ts skips cleanly when no database is reachable, like its siblings. Why: found in TASK-0180 Phase 1 (2026-10-30). Its describe block (since dd3d8e5d, TASK-0046) has no describe.skipIf(!reachable), so plain pnpm ci:check without a DB fails 5 tests instead of skipping. jobs.integration.test.ts shows the pattern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The adjudicate describe block uses describe.skipIf(!reachable) like jobs.integration.test.ts
- [ ] #2 pnpm ci:check with no database skips these 5 tests instead of failing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
