---
id: TASK-0154
title: DB integration tests time out at 5 s under full-suite load
status: To Do
assignee: []
created_date: '2026-10-27 04:11'
updated_date: '2026-10-28 14:52'
labels:
  - test
  - bug
  - server
milestone: m-3
dependencies: []
priority: low
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the server's DB-backed scene and playtest integration tests pass reliably under a full REQUIRE_DATABASE=1 run, without single re-runs. Evidence (M3 sweep, 2026-10-27): test/dm/scene.integration.test.ts 'plays Greyhollow Ford' (TASK-0116 Phase 2) and test/playtest/harness.integration.test.ts (TASK-0051 Phase 2) each hit vitest's 5 s default timeout under full-suite load, passed alone in about 3 s, and passed on a single re-run. Distinct from the known WebSocket gateway flake.

Spec: specs/056-db-test-timeouts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The affected tests set an explicit timeout sized to their measured worst case, or the suite isolates them so load does not starve them
- [ ] #2 Three consecutive full REQUIRE_DATABASE=1 server runs pass without re-runs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Third instance 2026-10-27: test/playtest/provider.integration.test.ts timed out at 5 s under full-suite load on TASK-0116 Phase 3; passed alone (3 tests).

2026-10-27: on TASK-0051 the 5090 ms scene.integration hit was load plus a per-turn full-log replay in gate.recordPresence; fixed on that branch (2b09a07). The other instances stand.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
