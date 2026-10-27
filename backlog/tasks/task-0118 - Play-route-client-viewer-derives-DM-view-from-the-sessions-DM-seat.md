---
id: TASK-0118
title: 'Play route: an unseated operator with an AI DM seat views as a player'
status: In Progress
assignee: []
created_date: '2026-10-27 01:47'
updated_date: '2026-10-27 03:28'
labels:
  - play-route
  - web
  - bug
milestone: m-3
dependencies:
  - TASK-0048
documentation:
  - docs/design/debug-view.md
priority: medium
ordinal: 38700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an operator who holds no seat at a table with an AI DM seat sees the player view on /play, not DM UI over player-filtered events.

Why: TASK-0048 (commit 53a78fa on branch task-0048-playtest, operator ruling 'Fix the view') replaced viewerForUser with apps/web/app/play/viewer.ts viewerFor(user, projections). It already handles two cases: the human DM seat holder views as DM, and a user who controls a party character views as a player. It keeps one gap on purpose: an unseated operator still falls back to the DM viewer. The server gives the DM view only to a seated human DM (apps/server/src/ws/registry.ts viewerFor, the TASK-0045 ruling). So with an AI DM seat, an unseated operator gets DM UI (approvals panel, isDm) over player-filtered events. This card closes that one case. Found during the debug-view design (docs/design/debug-view.md); the debug view (TASK-0117) is where an unseated operator sees DM-only data.

Spec: specs/038-unseated-operator-view
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With an AI DM seat, an unseated operator's /play renders the player view, with no approvals panel.
- [ ] #2 The seat-holder and character-controller cases of viewerFor keep their TASK-0048 behaviour.
- [ ] #3 viewer.test covers the unseated-operator case with an AI DM seat and with a human DM seat held by someone else.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0118, branch task-0118-unseated-operator-view, cut from origin/main a4aab3c. Spec number 038 claimed with a stub. Track B3.
<!-- SECTION:NOTES:END -->
