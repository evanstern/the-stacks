---
id: TASK-0268
title: Gate accepts Intents
status: In Progress
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-11T05:26:00Z'
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
- [ ] #1 A confirmed `attack` Intent from a player appends engine events with no model call.
- [ ] #2 A `needs_ruling` result enqueues a ruling job (AI seat) or a proposal row (human seat).
- [ ] #3 Existing `action.declare` clients keep working through the envelope.
- [ ] #4 A zone reveal Intent maps through the gate, and targetStatus 'ok' maps to seen (spec 100 OQ-4).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 100 OQ-4 added. After merge, close TASK-0147 as absorbed and trim TASK-0145 to AC #2-#4 (spec 097 OQ-6).

Claimed 2026-11-10 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0268, branch task-0268-gate-intents, cut from origin/main fb396882. Spec number 102 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 102 authored (86d425b6) against plan commits 092 06d7ca13, 097 a34d5d39, 100 16ae6147, 099 58fc1fd4, 101 02b96689. ~2h7m, 79 tool calls; nudged to write after 2h of reading. Awaiting C-GATE ruling before implementation.
<!-- SECTION:NOTES:END -->
