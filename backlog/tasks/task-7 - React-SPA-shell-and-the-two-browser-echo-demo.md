---
id: TASK-7
title: React SPA shell and the two-browser echo demo
status: To Do
assignee: []
created_date: '2026-09-22 01:14'
updated_date: '2026-09-22 06:43'
labels: []
milestone: m-0
dependencies:
  - TASK-6
documentation:
  - docs/design/milestones.md
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the client half of the walking skeleton and the M0 demo itself: two browsers sign in, and a message sent from one appears in the other via the event log. Per architecture A1 this is a Vite SPA with TanStack Router and Query, not SSR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A React 19 + Vite SPA builds and is served by the app container
- [ ] #2 TanStack Router and TanStack Query are wired
- [ ] #3 A sign-in view authenticates against the session auth and persists the session across reload
- [ ] #4 A minimal view subscribes over WebSocket and renders events from the log
- [ ] #5 A user can send a message that reaches the other signed-in browser
- [ ] #6 Reloading the page replays prior events from the log rather than showing an empty view
- [ ] #7 The M0 demo runs end to end from docker compose up with two browsers signed in as different users
<!-- AC:END -->
