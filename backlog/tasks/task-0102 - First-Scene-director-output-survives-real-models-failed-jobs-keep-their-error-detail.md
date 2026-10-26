---
id: TASK-0102
title: >-
  First Scene: director output survives real models; failed jobs keep their
  error detail
status: In Progress
assignee: []
created_date: '2026-10-26 14:50'
updated_date: '2026-10-26 15:33'
labels:
  - first-scene
  - dm
  - ai
milestone: m-2
dependencies: []
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with real models through the gateway, the DM runtime's director node yields schema-valid output, so a turn no longer fails with 'stopped at director: invalid-output'. When any node's output does fail validation, the job record keeps the schema issues and enough of the raw output to diagnose it.

Why: TASK-0048's paid scripted playtests (docs/design/m2-demo/provider-playtest*) stalled at the third or fourth turn in 2 of 2 runs.
- Run 2: the director hit maxTokens 600 and its JSON was truncated.
- Run 4: with maxTokens 1500, the director produced 962 and then 280 tokens, and both failed the schema, so it was not truncation.
- The failed job's error is only 'stopped at director: invalid-output'. apps/server/src/dm/pipeline/call.ts builds detail.issues, but the job error drops it.
The M2 demo cannot reach the scene's end until this is fixed. Carded by operator ruling 2026-10-26; it fixes code from TASK-0046 (specs/031-dm-runtime) and blocks TASK-0048's demo phase.

Approach: capture the real failing director output first, from a run against the configured provider under an operator-approved spend ceiling. Then fix the prompt, the schema or the parsing, whichever the evidence shows. No vendor SDK (decision-0007). The engine still owns every number.

Spec: specs/033-director-robustness
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failed node-output validation stores its schema issues, the purpose and a bounded excerpt of the raw output in the turn job's error detail, and a test proves it.
- [ ] #2 The real failing director output is captured and committed as a fixture, and a test reproduces the failure against it.
- [ ] #3 The director accepts real-model output for the Greyhollow Ford scene: a provider-mode playtest gets past the turn where runs 2 and 4 failed, with no director invalid-output.
- [ ] #4 Any schema or prompt change keeps every existing dm test green, and the scripted CI playtest still passes.
- [x] #5 Spec phase: Persist diagnostics (US1; AC #1)
- [x] #6 Spec phase: Capture the real failure (US2; AC #2) — ORCHESTRATOR-RUN, PAID
- [x] #7 Spec phase: Classify and fix (US2, US3; AC #2, #3)
- [ ] #8 Spec phase: Verification run (US3; AC #3) — ORCHESTRATOR-RUN, PAID
- [ ] #9 Spec phase: Full gate (US4; AC #4)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (operator ruling: a new M2 card fixed in its own PR before the demo resumes). Worktree .worktrees/task-0102, branch task-0102-director-robustness, cut from origin/main 60e8f89. Spec number 033 claimed with a stub.

Spec authoring by opus-implementer: e84da5a. Clarify was skipped.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Design: the failure record goes in jobs.result.failure (issues, plus attempt excerpts up to 8000 chars). jobs.error stays a fixed string. normalizeDirector is lenient but never touches a number. Phases 2 and 4 are paid, orchestrator-run captures in a composite worktree (origin/task-0048-playtest plus this branch, never pushed). The spec defaults on its open questions stand. Q5 is moot, since 31f61f7 is now pushed.

Phase 1 by sonnet-implementer: 1ab1136. A failed turn now writes jobs.result.failure {node, kind, message, detail: {purpose, promptVersion, issues, attempts[{attempt, outputTokens, chars, issues, excerpt}]}}. jobs.error stays a fixed string. /turns never serves the record. The server suite passes 657 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
OPERATOR APPROVAL 2026-10-26, in the operator's words: 'Approved: spend ceiling $22 for the TASK-0102 capture run and $22 for its verification run.'

Phase 2 setup 2026-10-26 (orchestrator): composite worktree .worktrees/task-0102-run = origin/task-0048-playtest 639a94c + merge of origin/task-0102-director-robustness → 15f15fe (detached, never pushed). The merge conflicted only in .specify/feature.json (Spec Kit pointer, no code); resolved in the composite to the 033 side, neither branch touched. Stack stacks-task-0102-run (app :4951, db :16951, test-db :26951), both DBs migrated by hand (TASK-0098). dm.director maxTokens 1500 (claude/cc/claude-opus-5). Estimate: expected $1.90, upper bound $20.82. Capture ceiling $22 (operator approval above).

Phase 2 capture attempt 1 (runId 20261026T150802Z-greyhollow-ford-provider) was killed by SIGTERM when the desktop app restarted. It wrote no run directory, and the stack's DBs came back empty, so its spend is unrecorded (cc/ routes are subscription-backed). The DBs were re-migrated. The capture is rerun under the same $22 approval, detached with nohup.

Phase 2 capture 2026-10-26: run 20261026T150925Z-greyhollow-ford-provider, composite 15f15fe. Outcome failed: 12 turns succeeded and 5 moves committed (past the run 2/4 failure turns), then the turn at triggerSeq 114 (pt-5, reed-camp fight) stopped at director: invalid-output. Both attempts had goalNote over 300 chars (367 and 309; 783 and 245 output tokens). Spend $2.82 over 121 calls of the $22 ceiling. Fixture and evidence: cfd4929. Classification: C4 only, no prompt change (evidence/classification.md).

Phase 3 by sonnet-implementer: 900f48c (T013 reproduction, green on unfixed code) and 75ba690 (C4: normalizeDirector caps goalNote and beat/tableMode/scene/trackers reason at 300 chars at a word boundary; optional normalize hook on callJson; only the director passes it; no prompt change, PROMPT_VERSION stays dm.director-v1). Server suite with REQUIRE_DATABASE=1: 677 passed, 5 skipped. Lint, typecheck and boundaries pass. No WS flake. Orchestrator reviewed the diff.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 setup: composite at aa960b3 (branch tip 3bd622e merged in). Verification ceiling $22 (operator approval above).

Phase 4 verification 2026-10-26: run 20261026T152743Z-greyhollow-ford-provider, composite aa960b3. Spend $1.00 over 51 calls of the $22 ceiling. 4 moves committed and no director invalid-output, so quickstart C5 passes literally. But the run failed at turn job 6 (npc-turn, triggerSeq 61, act-kestrel-1): stopped at interpret: invalid-output. Attempt 1 hit maxTokens 1200 inside a code fence. Attempt 2 applied an invented condition 'spotted-lookout' (not in the condition enum). The run did not reach the reed-camp turn, so the C4 fix is proven offline only. Interpret is out of this spec's scope (contracts/director-output.md, 'Out of scope'). Evidence and second fixture: c085844. STOPPED for an operator ruling before any further spend.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
