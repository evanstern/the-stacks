---
id: TASK-0177
title: Operator seats a human DM from the web
status: In Progress
assignee: []
created_date: '2026-10-29 03:01'
updated_date: '2026-10-29 04:33'
labels:
  - play-route
  - multiplayer
milestone: m-3
dependencies: []
priority: high
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: on hosted dev the operator can seat a human DM (themself or another account) and return the seat to the AI DM from the web app, with no modal, before or during a scene.

Why: the TASK-0176 spec author (spec 061, 8f8a6808, finding F-1) found that nothing on hosted dev sends `dm.seat`: `git grep "dm.seat" apps/web` is empty, `docs/ops/dev-vm-104.md` has no step for it, and only the local evidence script `specs/055-human-dm-scene-change/evidence/start-human-dm.mjs` sends it. The TASK-0053 demo second run (policy ask, a human DM beside three players) needs it. Operator ruling 2026-10-28 in chat, answering "Should I card F-1, seating a human DM from the web, in m-3 before the demo?": "Card it in m-3".

Spec: specs/062-human-dm-seat
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play route offers the operator a control that seats a human DM from a gate request, with no modal, and a test
- [ ] #2 The same control returns the DM seat to the AI DM, with a test
- [ ] #3 docs/ops/dev-vm-104.md documents seating a human DM for an assisted table
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, in the M3 sweep chat, verbatim: "Before we start on another slice of M-3 I'd like to pause -- after the next PR merges." Read as: the sweep finishes TASK-0176 through its PR merge, then stops; TASK-0177 does not start until the operator resumes.

Claimed 2026-10-29 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0177, branch task-0177-human-dm-seat, cut from origin/main 7e9ef92f. Spec number 062 claimed with a stub. Resumed by the operator on 2026-10-29 ("resume the sweep").
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
