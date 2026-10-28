---
id: TASK-0158
title: Env-reachable scripted fake DM provider for live UI checks
status: In Progress
assignee: []
created_date: '2026-10-27 09:59'
updated_date: '2026-10-28 04:24'
labels:
  - dm
  - debug-view
  - dev-tooling
milestone: m-3
dependencies: []
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a worktree stack can run a full fake-gateway turn (director through narration) driven by a script chosen in the app's environment, so live UI checks show a happy-path turn. Evidence: TASK-0117 Phase 6 (spec 041, b4d0378, live-check.md) routed dm.* to the fake provider, which returns empty bodies. Scene-start and every turn failed invalid-output at the director, so job-to-event highlighting and a narrated turn could not be shown live. Tests script the fake through loadDmScript, which the running app cannot reach. Needed for the TASK-0117 merge condition (screenshots during a live fake-gateway turn) and for any later UI evidence. No provider key and no paid run.

Spec: specs/053-env-fake-dm-script
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Setting one env value (a script path or name) makes the running app's fake provider replay a DM script, with a test
- [ ] #2 A documented quickstart runs a narrated turn on a worktree stack with no key
- [x] #3 Spec phase: Script-mode runtime and its boot guard (card AC #1)
- [x] #4 Spec phase: Boot wiring, the live script and a scripted scene-start (card AC #1)
- [ ] #5 Spec phase: Image, env docs and evidence helpers (card AC #2)
- [ ] #6 Spec phase: Live quickstart run on this worktree's stack (card AC #2)
- [ ] #7 Spec phase: Merge main, wiki re-ground and runbook rows (card AC #1, #2)
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0158, branch task-0158-env-fake-dm-script, cut from origin/main e631d45. Spec number 053 claimed with a stub. Spec 052 is held by TASK-0157 (PR #77), so this takes 053.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (spec.md, 5039353) stopped with open questions Q1-Q8. Root cause: index.ts builds the gateway with the default FakeProvider (empty queues, not strict), so the director got empty bodies; loadDmScript is test-only and test scripts are not in the image.

Operator ruling, 2026-10-27, verbatim: "TASK-0158: I accept the recommended defaults Q1 to Q8, including the DM_FAKE_SCRIPT name, the shipped dm-scripts directory, the whole-config replacement and the STACKS_ENV boot guard."

Correction: the operator ruling above was given 2026-10-28, not 2026-10-27.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (7144696, a8318ce): createAiRuntime in dm/script/env.ts, 17 tests red then green. Mutation (STACKS_ENV guard off): 5 refuse cases fail; restored, diff empty. ci:check without a DB fails only the 5 known adjudicate.integration tests; the DB run is Phase 2's.

spec-bridge sync: Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 0/6 · Image, env docs and evidence helpers (card AC #2): 0/5 · Live quickstart run on this worktree's stack (card AC #2): 0/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 0/5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (3307fc0): index.ts wired through createAiRuntime; greyhollow-live.json shipped; DB test runs a scripted scene-start (narration lands, every ledger row provider scripted, null cost). REQUIRE_DATABASE=1 ci:check exit 0 (server 1236). Finding: the scene-start already queues a dm.chronicle job, which fails (no chronicle call in the script). Orchestrator direction: Phase 3 adds dm.chronicle calls to greyhollow-live for each turn that queues one (scene-start and the exploration turn), within T021's latitude, and loosens the T008 equality to allow them.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
