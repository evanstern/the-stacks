---
id: TASK-0298
title: Narration streams to clients
status: In Progress
assignee: []
created_date: 2026-11-08 19:56
updated_date: '2026-11-13T00:35:00Z'
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
- [x] #1 Prose slots stream to every permitted viewer as partial frames while the model writes.
- [x] #2 Fact rows render before the first prose token and never wait for narration.
- [x] #3 A viewer that joins mid-stream sees the settled slot text after the stream ends.
- [x] #4 The next turn's Intent is accepted while narration still streams, with a test.
- [x] #5 Time to first narration token is recorded per narrate job.
- [ ] #6 Spec phase: Stream core (pure)
- [ ] #7 Spec phase: Pipeline wiring and timing
- [ ] #8 Spec phase: Delivery and C-GATE amendments
- [ ] #9 Spec phase: Web rendering
- [ ] #10 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0298, branch task-0298-narration-stream, cut from origin/main 3f85a1bd. Spec number 108 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 108 (da6ee720): 29 tasks, 5 phases, no split. Streams one checked sentence at a time, so a dropped sentence is never streamed. New narration-stream frame (C-GATE). AC #4 needs no code change. AC #5 goes in the job checkpoint, with no migration. Awaiting the C-GATE ruling before phase 3.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 (e1ff0321, d1d012e7): ci:check exit 0; server suite REQUIRE_DATABASE=1 1905 passed. Prefix property holds at 1-, 3- and 17-char splits over 16 hand cases and 106 narrate fixtures, and no dropped sentence ever streamed. Fogged-zone and absent-actor cases assert string absence only. No frozen frame touched (verified by diff). checkBase() is shared from nodes/check.ts into narrate.ts; check-boundaries passes.

C-GATE ruling (operator, 2026-11-12, in chat): "Approve all". This approves the spec 108 plan.md "C-GATE: frozen contract amendments": the narration-stream frame in ws-protocol (006 contract, wiki note and protocol.ts), guarantee 1 scoped to event frames, and useSession returning stream (030 live-frames). It also approves OQ-1..OQ-4 as recommended. OQ-1 and OQ-3 are carded with CP-7 triggers.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-5 (5a79b4ee, 753a40d2, f0f9319d): ci:check exit 0 with REQUIRE_DATABASE=1 (server 1913, web 164). Contract amendments quote 'Approve all'. AC #4 is tested in free and turn mode with narrate paused mid-call. Gap: canSee(public) is true for every role, so no exclusion case can be tested. Wiki: 21 notes reviewed.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Live check in Brave (1c0cf189) on the worktree app in script mode, one isolated context, no vm-104 page touched. The settled row shows once with no leftover block. The in-flight block was caught: label, rows first, then prose, with aria-live=polite and aria-busy=true. No modal and no overflow at 1280 or 390 px. Note: the transcript <ol> has no accessible name; carded.
<!-- SECTION:NOTES:END -->
