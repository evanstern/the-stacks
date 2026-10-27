---
id: TASK-0116
title: 'Debug view: operator debug API and persisted model-call usage'
status: Done
assignee: []
created_date: '2026-10-27 01:47'
updated_date: '2026-10-27 04:32'
labels:
  - debug-view
  - server
  - dm-runtime
milestone: m-3
dependencies: []
documentation:
  - docs/design/debug-view.md
priority: high
ordinal: 38500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the server exposes everything the DM/debug view needs, operator-only, and every DM model call records its usage.

Why: during the M2 demo (TASK-0048) the DM's inner workings were invisible from the table. Turn jobs, companion holds and narration fallbacks had to be diagnosed by SQL. Per-call model, tokens, cost and duration are logged but never stored. Design: docs/design/debug-view.md (card A, decisions D1, D3, D4).

Scope: server only. The web page is the dependent card.

Spec: specs/037-debug-api
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every stored DM model-call record carries provider, model, input tokens, output tokens, costUsd and durationMs, on the callJson, callText, companion and chronicle paths.
- [x] #2 No stored call record or debug response contains prompt or completion text beyond the existing bounded failure excerpts.
- [x] #3 An operator-only route returns a session's full event log after a given seq, all visibilities, paginated.
- [x] #4 An operator-only route returns a session's DM jobs with full input and result: checkpoint, audit, calls and failure.
- [x] #5 An operator-only route returns the session's scene seed as loaded, DM-only facts included.
- [x] #6 A non-operator request to each new route gets 403; an unauthenticated request gets 401.
- [x] #7 GET /dm/sessions/:id/turns keeps its current response contract.
- [x] #8 The DM API contract and the wiki notes the change touches are updated and re-pinned.
- [x] #9 Spec phase: Usage capture at the gateway and the call helpers (US1; AC #1, #2) — DISPATCH (sonnet)
- [x] #10 Spec phase: The usage ledger, migration 0005, worker wiring and submission seqs (US1, US3; AC #1, #2, #4; merge condition) — DISPATCH (sonnet)
- [x] #11 Spec phase: The operator debug routes (US2, US3, US4, US5; AC #2–#7) — DISPATCH (sonnet)
- [x] #12 Spec phase: Wiki re-ground and full gate (AC #8) — DISPATCH (sonnet)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator 2026-10-26: sequencing of the debug-view cards (TASK-0116, 0117, 0118) is discussed after the M2 First Scene sweep closes M2, not before. The M2 orchestrator raises it at the M2 close checkpoint.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0116, branch task-0116-debug-api, cut from origin/main a4aab3c. Spec number 037 claimed with a stub. Track B2. Design: docs/design/debug-view.md card A.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 037, commit 06eb633; ~202k tokens; served verified from transcript.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 1, T001-T007, commit d13f1e3; ~113k tokens; served verified from transcript.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 2, T008-T017, commit bdfeb05; migration 0005_unknown_lizard (dm_model_calls). Merge condition T013 met: ledger rows equal jobs.result.calls in a full fake-gateway turn. scene.integration 'plays Greyhollow Ford' hit the 5 s vitest timeout under full-suite load once; passed on the single re-run.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 3, T018-T029, commit fac9d65; four operator-only GET routes; first full ci:check failed only on playtest/provider.integration 5 s load timeout (TASK-0154), passed alone.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 4 wiki + full gate, T030-T037, commit 37c4341; 8 notes NEEDS-REVIEW amended and re-pinned; new note debug-view; final ci:check exit 0 after one TASK-0154 re-run.)
OPERATOR RULING 2026-10-27 (in chat, spec open question 1): 'Ship everywhere' — the four debug routes ship on every host behind the operator gate, no feature flag.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged in PR #62 (654ad7b). Operator-only read-only debug API under /dm (events, jobs, seed, calls; 401/403 before validation; /turns unchanged) and the dm_model_calls usage ledger (migration 0005_unknown_lizard) recording every DM model call's provider, model, tokens, cost and duration; prompt text never stored. ChatRequest.onUsage; seqs on every stored submission. Merge condition met: ledger rows equal jobs.result.calls in a full fake-gateway turn. Spec 037, 37/37 tasks. Wiki: 8 notes re-pinned, new note debug-view. Routes ship on every host (operator ruling 2026-10-27).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
