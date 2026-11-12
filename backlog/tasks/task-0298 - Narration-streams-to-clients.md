---
id: TASK-0298
title: Narration streams to clients
status: In Progress
assignee: []
created_date: 2026-11-08 19:56
updated_date: '2026-11-12T20:36:00Z'
labels:
  - ws:narration
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0272
priority: high
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The gateway streams text, but `dm/pipeline/call.ts` collects the whole reply before anything reaches the table. `ws/protocol.ts` has no partial-narration frame. R1 exit criterion 2 (first narration token p50 under 10 s) and the demo rule "narration never blocks the next turn" need streamed prose slots.

Source: docs/design/r1-fast-table-runbook.md finding F5, CP-5 ruling 2026-11-08. Parent epic: TASK-0258. (gap G1).

Spec: specs/108-narration-stream
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prose slots stream to every permitted viewer as partial frames while the model writes.
- [ ] #2 Fact rows render before the first prose token and never wait for narration.
- [ ] #3 A viewer that joins mid-stream sees the settled slot text after the stream ends.
- [ ] #4 The next turn's Intent is accepted while narration still streams, with a test.
- [ ] #5 Time to first narration token is recorded per narrate job.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0298, branch task-0298-narration-stream, cut from origin/main 3f85a1bd. Spec number 108 claimed with a stub.
<!-- SECTION:NOTES:END -->
