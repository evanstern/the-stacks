---
id: TASK-0016
title: React SPA shell and the two-browser echo demo
status: To Do
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-23 04:18'
labels: []
milestone: m-0
dependencies:
  - TASK-0014
  - TASK-0015
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Scope: Phase 1 (T001-T004) + User Story 1 (T005-T010) — Vite workspace, static serving, Dockerfile. Served model read from the dispatch transcript, not inferred from the pin.

AC#7 two-browser verification is possible in this session (resolves the handoff's open question).

Branded Chrome is NOT installed, so both browser MCP servers fail at their default path. Available and verified instead:
- Google Chrome for Testing 149.0.7827.55 at ~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/ -- launched with --remote-debugging-port and an isolated --user-data-dir, confirmed live on the DevTools endpoint, then stopped.
- Brave Browser (/Applications), offered by the operator as a Playwright executablePath.

Approach for T026: two Chrome-for-Testing instances on separate debug ports with separate --user-data-dir profiles = two genuinely isolated cookie jars, attached via chrome-devtools-mcp --browserUrl. Two tabs in one profile share one session cookie and would prove nothing.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
