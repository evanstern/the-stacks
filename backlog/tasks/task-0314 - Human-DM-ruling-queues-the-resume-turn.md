---
id: TASK-0314
title: Human DM ruling queues the resume turn
status: In Progress
assignee: []
created_date: '2026-11-12T01:14:00Z'
updated_date: '2026-11-12T03:21:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - bug
milestone: m-10
dependencies:
  - TASK-0269
ordinal: 298000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-0269 (PR #168). When a human DM answers an open needs_ruling request with a ruling Intent, no turn is queued to resume the waiting action. Enqueue rule 2 fires only for ai:dm proposals. The confirm's approval queues one turn, which finds the ask still open. The human-dm-roll-resume test queues the approval turn by hand. This breaks human-DM play whenever a ruling is needed (spec 104, spec 102 FR-021..FR-025).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A ruling Intent from a seated human DM that answers an open request queues one resume turn for the waiting action.
- [x] #2 human-dm-roll-resume runs with no hand-queued turn.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0314, branch task-0314-ruling-resume, cut from origin/main c3eb7cf8. No spec dir: signed escape line covers this task.

Escape line E10 signed by the operator 2026-11-11 in chat ("Sign E10"): card ACs drive, with no spec set.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Enqueue rule 8 humanRulingResume (980e1c5b); wiki (c6497cd7). Full server suite REQUIRE_DATABASE=1: 1802 passed. TASK-0199's planned rule 8 becomes the next number.
<!-- SECTION:NOTES:END -->
