---
id: TASK-0158
title: Env-reachable scripted fake DM provider for live UI checks
status: Done
assignee: []
created_date: '2026-10-27 09:59'
updated_date: '2026-10-28 05:07'
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
- [x] #1 Setting one env value (a script path or name) makes the running app's fake provider replay a DM script, with a test
- [x] #2 A documented quickstart runs a narrated turn on a worktree stack with no key
- [x] #3 Spec phase: Script-mode runtime and its boot guard (card AC #1)
- [x] #4 Spec phase: Boot wiring, the live script and a scripted scene-start (card AC #1)
- [x] #5 Spec phase: Image, env docs and evidence helpers (card AC #2)
- [x] #6 Spec phase: Live quickstart run on this worktree's stack (card AC #2)
- [x] #7 Spec phase: Merge main, wiki re-ground and runbook rows (card AC #1, #2)
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

spec-bridge sync: Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 6/6 · Image, env docs and evidence helpers (card AC #2): 0/5 · Live quickstart run on this worktree's stack (card AC #2): 0/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 0/5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (80633dd chronicle calls, ae21f3d image/env/helpers): both narrated turns queue chronicle (runner sets resolve.chronicle when narration lands); two dm.chronicle calls added; integration asserts chronicle model call outcome ok. Image contains dm-scripts/greyhollow-live.json. ci:check exit 0 (server 1236). Helpers are syntax-checked only; Phase 4 runs them live.

spec-bridge sync: Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 6/6 · Image, env docs and evidence helpers (card AC #2): 5/5 · Live quickstart run on this worktree's stack (card AC #2): 0/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 0/5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 first pass stopped at quickstart step 2: pnpm db:migrate migrates only the test DB, and the quickstart's app-DB step says to build a URL from .env credentials, which the dispatch rules forbid. Orchestrator ruling: migrate the app DB credential-free the way deploy/dev/compose.dev.yml's migrate service does - build the Dockerfile build stage and run scripts/migrate.ts inside the stack's compose network with --env-file .env and TEST_DATABASE_URL empty, so no credential is read or printed. The quickstart must document this instead of hand-building a URL. Also found: the worktree .env has no trailing newline, so echo >> fused DM_FAKE_SCRIPT onto AI_PRICES; quickstart must use printf with a leading newline.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 (6c7b9ca, resumed after the migrate ruling): live run on stacks-task-0158. App DB migrated credential-free in the build-stage container. Scene-start and act-search narrated (1d20 14 vs DC 13 success); jobs turn, chronicle, turn, chronicle all succeeded. dm_model_calls: 10 rows all provider scripted, no cost; 9 script calls outcome ok; the deliberate spent-script call failed loudly (config, unscripted call for dm.director). Unset value boots without script mode. 12 Brave shots in evidence/shots/. Quickstart corrected. T025 (DB ci:check) left to the orchestrator: the agent's export of TEST_DATABASE_URL was denied by the auto-mode classifier.

T025: REQUIRE_DATABASE=1 pnpm ci:check run by the orchestrator on 6c7b9ca exits 0 (server 111 files passed, 1 skipped). The implementer ticks T025 in Phase 5.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 5: merge of origin/main 89d75e2 (clean), wiki d6f58a0 (14 notes re-pinned, CAPSULES regenerated), runbook rows and ticks bf32bf2. Freshness OK (54), spec-bridge ok.

spec-bridge sync: Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 6/6 · Image, env docs and evidence helpers (card AC #2): 5/5 · Live quickstart run on this worktree's stack (card AC #2): 7/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 5/5 — status In Progress → Done

REQUIRE_DATABASE=1 pnpm ci:check on the merged tree (bf32bf2) exits 0, server 1244 passed. AC #1: DM_FAKE_SCRIPT=<name> loads a shipped script into the running app (script-env tests, DB integration, live run). AC #2: specs/053-env-fake-dm-script/quickstart.md, run live on stacks-task-0158 (evidence/live-run.md).

spec-bridge sync: Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 6/6 · Image, env docs and evidence helpers (card AC #2): 5/5 · Live quickstart run on this worktree's stack (card AC #2): 7/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 5/5 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Script-mode runtime and its boot guard (card AC #1): 7/7 · Boot wiring, the live script and a scripted scene-start (card AC #1): 6/6 · Image, env docs and evidence helpers (card AC #2): 5/5 · Live quickstart run on this worktree's stack (card AC #2): 7/7 · Merge main, wiki re-ground and runbook rows (card AC #1, #2): 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
