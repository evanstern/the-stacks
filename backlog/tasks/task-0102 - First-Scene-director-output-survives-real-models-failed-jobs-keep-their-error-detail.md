---
id: TASK-0102
title: >-
  First Scene: director output survives real models; failed jobs keep their
  error detail
status: In Progress
assignee: []
created_date: '2026-10-26 14:50'
updated_date: '2026-10-26 14:59'
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
- [ ] #5 Spec phase: Persist diagnostics (US1; AC #1)
- [ ] #6 Spec phase: Capture the real failure (US2; AC #2) — ORCHESTRATOR-RUN, PAID
- [ ] #7 Spec phase: Classify and fix (US2, US3; AC #2, #3)
- [ ] #8 Spec phase: Verification run (US3; AC #3) — ORCHESTRATOR-RUN, PAID
- [ ] #9 Spec phase: Full gate (US4; AC #4)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (operator ruling: a new M2 card fixed in its own PR before the demo resumes). Worktree .worktrees/task-0102, branch task-0102-director-robustness, cut from origin/main 60e8f89. Spec number 033 claimed with a stub.

Spec authoring by opus-implementer: e84da5a. Clarify was skipped.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Design: the failure record goes in jobs.result.failure (issues, plus attempt excerpts up to 8000 chars). jobs.error stays a fixed string. normalizeDirector is lenient but never touches a number. Phases 2 and 4 are paid, orchestrator-run captures in a composite worktree (origin/task-0048-playtest plus this branch, never pushed). The spec defaults on its open questions stand. Q5 is moot, since 31f61f7 is now pushed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
