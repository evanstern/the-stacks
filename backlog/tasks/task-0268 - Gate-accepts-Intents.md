---
id: TASK-0268
title: Gate accepts Intents
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-10 03:11'
labels:
  - 'ws:intent'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirmed `attack` Intent from a player appends engine events with no model call.
- [ ] #2 A `needs_ruling` result enqueues a ruling job (AI seat) or a proposal row (human seat).
- [ ] #3 Existing `action.declare` clients keep working through the envelope.
- [ ] #4 A zone reveal Intent maps through the gate, and targetStatus 'ok' maps to seen (spec 100 OQ-4).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 100 OQ-4 added. After merge, close TASK-0147 as absorbed and trim TASK-0145 to AC #2-#4 (spec 097 OQ-6).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
