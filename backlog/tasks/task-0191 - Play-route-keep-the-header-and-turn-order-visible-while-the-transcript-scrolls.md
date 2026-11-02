---
id: TASK-0191
title: >-
  Play route: keep the header and turn order visible while the transcript
  scrolls
status: In Progress
assignee: []
created_date: '2026-11-02 04:21'
updated_date: '2026-11-02 06:31'
labels:
  - web
  - ux
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the table header (presence, mode, Ledger, DM seat, Debug) and the turn-order strip stay visible however far the transcript scrolls.

Why: alpha run 3 (2026-11-01), finding 10. Once combat started and the chat grew, the header scrolled out of view and the operator could not see the turn order.

Where: apps/web/app/play/table-view.tsx. The header and TurnOrder render above the transcript scroll container; check whether the page or the container scrolls, and pin the header (sticky or a fixed flex row outside the scroll area).

Related: TASK-0187 (transcript width), TASK-0164 (party slide-out), TASK-0188 (chat redesign).

References: docs/playtests (run 3 log, lands at wrap).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header and the turn-order strip stay visible while the transcript scrolls, at 1280 px and 390 px
- [x] #2 Only the transcript scrolls; the composer stays pinned at the bottom
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0191, branch task-0191-sticky-table-header, cut from origin/main 7e252840. No spec dir: signed escape line covers this task. Lane A4. Escape E2: card ACs drive.

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5

Operator ruling 2026-11-02 (in chat, answering 'How should the remaining lanes get write access to .worktrees/?'): "Allow edits via Bash". The harness edit guard blocks Write/Edit outside the session worktree; dispatched agents edit worktree files through Bash (heredocs, sed, scripts) instead.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
