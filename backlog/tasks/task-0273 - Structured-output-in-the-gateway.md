---
id: TASK-0273
title: Structured output in the gateway
status: Done
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-09 05:40'
labels:
  - 'ws:narration'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 257000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a structured-output mode (tool call or JSON schema) per purpose in `apps/server/src/ai`. Log truncation separately from invalid JSON. Absorbs TASK-0203, 0256, 0197.

Prerequisite checkpoints: CP-1 (plan-of-action §7).

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-08).

Spec: specs/093-structured-output
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each DM purpose declares its output schema in config.
- [ ] #2 Attempt-1 schema failures are under 1% over the R1 playtest.
- [x] #3 The playtest watch shows a `truncated=` count.
- [x] #4 The vm-104 log shapes from TASK-0203 are regression fixtures.
- [x] #5 Phase 1: gateway structured mode (specs/093 tasks.md)
- [x] #6 Phase 2: callJson sends its schema; truncation logged apart
- [x] #7 Phase 3: interpret cap, boot warning, env example (needs OQ-3 C9 read or 8000 fallback)
- [x] #8 Phase 4: playtest watch counts
- [x] #9 Phase 5: wiki re-ground
- [ ] #10 Spec phase: Gateway structured mode (US1; FR-001 to FR-005; plan D1 to D3, D9)
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged from TASK-0197 (Playtest watch shows a truncated= count beside invalid-json=) by replan-2026-11: Truncation observability.

Merged from TASK-0203 (Haiku dm.audit and dm.chronicle return invalid-json on the first attempt) by replan-2026-11: Structured output; keep log shapes as fixtures.

Merged from TASK-0256 (dm.interpret hits its output cap and truncates on attempt 1) by replan-2026-11: Interpret truncation.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0273, branch task-0273-structured-output, cut from origin/main a8bda4ab. Spec number 093 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec authoring, grant C1)
Spec 093 committed (13993f3b). Phase ACs seeded. OQ-1, OQ-2, OQ-4, OQ-5 adopted as recommended. OQ-3 and OQ-6 wait on a read-only vm-104 query at C9; Phases 1-2 proceed meanwhile.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-2)
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 4)
Phases 1-2 (bc2a1dd3, a4f8eee4) and 4 (e559c92f) done. Phase 3 waits on the OQ-3 vm-104 read (operator approved the query; checkout path unknown) or the 8000 fallback.

AC tick correction: #2 (under 1% attempt-1 failures over the R1 playtest) is read at CP-7, not now; unticked. #3, #5, #6, #8 ticked.

OQ-3 reading 2026-11-08 via the read-only debug route /dm/sessions/bb4952dc-8600-48e8-a15f-2f4cf154625d/calls in the signed-in hosted page (no vm-104 shell command): dm.interpret attempt-1 n=26, max=4000, p95=4000, outcomes ok+truncated. The reading is saturated at the old 4000 cap, so it understates demand. Cap set to the spec's fallback 8000 (not the formula's 6000). OQ-6 (S9 fixture) skipped: no shell read.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 3, 5)
Phase 3: interpret cap 8000, boot warning for unstructured dm purposes, env example. Phase 5: 11 notes reviewed (5 prose changes), CAPSULES regenerated. ci:check exit 0 (server 1383 pass, DB suites skipped). Orchestrator re-ran freshness OK 61, plan empty. AC #2 reads at CP-7.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Gateway structured mode (US1; FR-001 to FR-005; plan D1 to D3, D9): 8/8 · callJson sends its schema; truncation logs apart (US1, US2, US4; FR-006 to FR-009, FR-013, FR-015; plan D4, D5, D7, D9): 9/9 · Interpret cap, boot warning and env example (US1, US5; FR-010, FR-011, FR-014; plan D6): 6/6 · Playtest watch counts (US3; FR-012; plan D8): 2/2 · Wiki re-ground: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
