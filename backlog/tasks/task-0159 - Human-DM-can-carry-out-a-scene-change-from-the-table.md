---
id: TASK-0159
title: Human DM can carry out a scene change from the table
status: In Progress
assignee: []
created_date: '2026-10-27 10:33'
updated_date: '2026-10-28 06:04'
labels:
  - play-route
  - gate
milestone: m-3
dependencies: []
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a seated human DM can change scene from the play route. That includes acting on a dismissed or pending scene suggestion. Evidence: the TASK-0100 spec author (spec 047, c53d50f, OQ-1) found that apps/web/app/play/frames.ts builds no scene request, so a human DM can read and dismiss a scene suggestion but cannot carry it out at the table. Why it matters: the M3 demo's second run is ask mode with a human DM (checkpoint C7).

Spec: specs/055-human-dm-scene-change
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play route offers a human DM a scene-change control built from a gate scene request, with no modal, and a test
- [ ] #2 A scene suggestion's content can seed that control
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0159, branch task-0159-human-dm-scene-change, cut from origin/main 7e3e029. Spec number 055 claimed with a stub. Spec 054 is held by TASK-0163 (PR #79), so this takes 055.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (spec.md, 212a4f8) stopped with open questions OQ-1 to OQ-7. Finding: with a human DM the scene-start suggestion stays pending, p.scene stays null, and every later AI DM turn fails no-scene until the human DM carries out a scene with the seed's sceneId.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
