---
id: TASK-0160
title: 'Revisit: events.integration T018 (50 concurrent appends, gapless) flaked once'
status: To Do
assignee: []
created_date: '2026-10-27 13:32'
labels:
  - revisit
  - flaky-test
dependencies: []
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed 2026-10-27 on branch task-0141-scene-presence (commit e83ae9d): test/events.integration.test.ts T018 failed once under REQUIRE_DATABASE=1 pnpm ci:check, then passed on re-run. The change under test did not touch the event log. Revisit trigger: a second failure of T018 on any branch. Then investigate append concurrency against TASK-0012's gapless contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a second T018 failure, the failure log is attached and the cause is found or the test is fixed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
