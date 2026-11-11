---
id: TASK-0268
title: Gate accepts Intents
status: Done
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-11T14:40:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0266
  - TASK-0267
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `intent` request kind to `gate/proposals.ts`. The gate checks seat, turn and policy, calls the planner, runs the engine and appends. `action.declare` becomes the `declared` envelope of an `attempt` Intent. DM-control Intents require the DM seat.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-03).

Spec: specs/102-gate-intents
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A confirmed `attack` Intent from a player appends engine events with no model call.
- [x] #2 A `needs_ruling` result enqueues a ruling job (AI seat) or a proposal row (human seat).
- [x] #3 Existing `action.declare` clients keep working through the envelope.
- [x] #4 A zone reveal Intent maps through the gate, and targetStatus 'ok' maps to seen (spec 100 OQ-4).
- [x] #5 Spec phase: Request kind, carrier event, projection and declare envelope (US3, AC #3)
- [x] #6 Spec phase: Pure Intent planning in session-model (US1, US4, AC #1, AC #4)
- [x] #7 Spec phase: Server gate wiring (US1, US2 human seat, AC #1, AC #2)
- [x] #8 Spec phase: AI-seat ruling job (US2 AI seat, AC #2)
- [x] #9 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 100 OQ-4 added. After merge, close TASK-0147 as absorbed and trim TASK-0145 to AC #2-#4 (spec 097 OQ-6).

Claimed 2026-11-10 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0268, branch task-0268-gate-intents, cut from origin/main fb396882. Spec number 102 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 102 authored (86d425b6) against plan commits 092 06d7ca13, 097 a34d5d39, 100 16ae6147, 099 58fc1fd4, 101 02b96689. ~2h7m, 79 tool calls; nudged to write after 2h of reading. Awaiting C-GATE ruling before implementation.

C-GATE ruling (operator, 2026-11-11, in chat): "Approve all" — approves the spec 102 plan.md "C-GATE: frozen contract amendments" table and every spec 102 open question (OQ-1..OQ-14) as recommended.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 done (6184167b, 14f1ccf6): ci:check green. Beyond plan: Dockerfile COPY for intent+planner (TASK-0303 guard), minimal web detailsOf intent case (T019 finishes it), gate/rows.ts + gate/floor-end.ts extracted. KIND_UNSERVED owner strings: predeclare -> N-10 (TASK-0275).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-4 done (73d10c33, 133bb13c): ci:check green; full server suite REQUIRE_DATABASE=1 2001 pass. Deviation: planner inputs at dm/seed/planner-inputs.ts (write-boundary model-reach test forbids gate/ reaching ai/gateway). A failed ruling call logs dm.ruling.call-failed and leaves the request open. Open: end_turn with ai:dm as actor untested.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 5 done (8ba29d64): 24 notes re-pinned; 4 new size_budget_exempt lines (orchestrator corrected 2 reasons).

spec-bridge sync: Request kind, carrier event, projection and declare envelope (US3, AC #3): 7/7 · Pure Intent planning in session-model (US1, US4, AC #1, AC #4): 7/7 · Server gate wiring (US1, US2 human seat, AC #1, AC #2): 6/6 · AI-seat ruling job (US2 AI seat, AC #2): 4/4 · Wiki re-ground: 3/3 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Request kind, carrier event, projection and declare envelope (US3, AC #3): 7/7 · Pure Intent planning in session-model (US1, US4, AC #1, AC #4): 7/7 · Server gate wiring (US1, US2 human seat, AC #1, AC #2): 6/6 · AI-seat ruling job (US2 AI seat, AC #2): 4/4 · Wiki re-ground: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
