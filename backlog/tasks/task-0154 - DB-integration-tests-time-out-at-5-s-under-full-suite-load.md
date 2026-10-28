---
id: TASK-0154
title: DB integration tests time out at 5 s under full-suite load
status: In Progress
assignee: []
created_date: '2026-10-27 04:11'
updated_date: '2026-10-28 15:11'
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
- [x] #3 Spec phase: Measure before the fix (card AC #1) — orchestrator-run
- [x] #4 Spec phase: Size and set the timeouts (card AC #1)
- [x] #5 Spec phase: Three consecutive full runs (card AC #2) — orchestrator-run
- [x] #6 Spec phase: Evidence, wiki, runbook and close (card AC #1, card AC #2)
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Third instance 2026-10-27: test/playtest/provider.integration.test.ts timed out at 5 s under full-suite load on TASK-0116 Phase 3; passed alone (3 tests).

2026-10-27: on TASK-0051 the 5090 ms scene.integration hit was load plus a per-turn full-log replay in gate.recordPresence; fixed on that branch (2b09a07). The other instances stand.

Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0154, branch task-0154-db-test-timeouts, cut from origin/main 934d8d78. Spec 056 authored at d78bdfe5 (explicit per-test timeouts, chosen over isolation; plan D1-D6).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Orchestrator ruling on spec OQ-1 (a test-evidence reading, not player-facing): default (a). A full run counts toward AC #2 only when it passes with no re-run, including the known WebSocket gateway flake; a failed run is kept as run-failed-<k>.txt and the count restarts. If the gateway flake blocks three clean runs twice in a row, the orchestrator reports it to the operator rather than widening the AC.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 1 (orchestrator, 2026-10-28): stack up and both DBs migrated. Alone, the 8 target tests ran 4-2102 ms; the full verbose baseline passed (server 1266 passed, 5 skipped) with no timeout, slowest target 2102 ms. Phase 2 (9a5fae22): every target test carries 30_000 with a TASK-0154 comment (D2 floor). No extra test over 2.5 s needed one. The implementer's no-DB server run failed 5 tests in adjudicate.integration.test.ts (requireDb throws instead of skipping), which is TASK-0138, untouched here.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
