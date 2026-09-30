---
id: TASK-0028
title: 'Chat UI: streaming answers and clickable citations'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-30 01:15'
labels:
  - ui
milestone: m-1
dependencies:
  - TASK-0027
  - TASK-0024
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The M1 demo surface. Not droppable.

Spec: specs/024-chat-ui
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator uploads a book and sees ingestion status
- [ ] #2 Answers stream into the chat as they generate
- [ ] #3 Clicking a citation opens the source passage with the quoted span highlighted
- [ ] #4 The M1 demo runs in two browsers from the per-worktree stack
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-09-29 (on merging PR #27, the M1 wave-2 runbook): TASK-0028 runs through pdlc:design-rounds in a sister session, not through the wave-2 sweep. The sweep orchestrator announces when 0027 and 0024 have merged and hands off a brief blurb.

Claimed 2026-09-29 for pdlc:design-rounds. Long-running worktree: .worktrees/task-0028, branch task-0028-chat-ui (cut from origin/main 8a79429). Spec number 024 claimed up front per the operator brief, overriding the skill's deferred-claim default; spec-bridge:link and the Spec Kit cycle still wait for the decision record.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
