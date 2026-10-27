---
id: TASK-0118
title: 'Play route: client viewer derives DM view from the session''s DM seat'
status: To Do
assignee: []
created_date: '2026-10-27 01:47'
updated_date: '2026-10-27 01:49'
labels:
  - play-route
  - web
  - bug
milestone: m-3
dependencies: []
documentation:
  - docs/design/debug-view.md
priority: medium
ordinal: 38700
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the /play client shows DM UI only to the user the server treats as DM.

Why: apps/web/app/play/use-live-table.ts viewerForUser treats any operator as DM. The server gives the DM view only to a seated human DM (apps/server/src/ws/registry.ts viewerFor, the TASK-0045 ruling). With an AI DM seat, the operator's /play renders DM UI (approvals panel, isDm) over player-filtered events. Found during the debug-view design (docs/design/debug-view.md, 'Separate bug card').
<!-- SECTION:DESCRIPTION:END -->


## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
