---
id: TASK-0016
title: React SPA shell and the two-browser echo demo
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-23 04:32'
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

Spec: specs/007-spa-shell-demo
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
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: User Story 1 — The SPA is served by the app container (Priority: P1)
- [ ] #10 Spec phase: User Story 2 — Sign in, and stay signed in across reload (Priority: P1)
- [ ] #11 Spec phase: User Story 3 — Live and replayed events in one view (Priority: P1)
- [ ] #12 Spec phase: User Story 4 — The two-browser demo (Priority: P1)
- [ ] #13 Spec phase: Gates
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Scope: Phase 1 (T001-T004) + User Story 1 (T005-T010) — Vite workspace, static serving, Dockerfile. Served model read from the dispatch transcript, not inferred from the pin.

AC#7 two-browser verification is possible in this session (resolves the handoff's open question). Branded Chrome is NOT installed, so both browser MCP servers fail at their default path. Verified available instead: Google Chrome for Testing 149.0.7827.55 from the Playwright cache, launched with --remote-debugging-port and an isolated --user-data-dir, confirmed live on the DevTools endpoint, then stopped; and Brave Browser, offered by the operator as a Playwright executablePath. Approach for T026: two Chrome-for-Testing instances on separate debug ports with separate profiles = two genuinely isolated cookie jars. Two tabs in one profile share one session cookie and would prove nothing.

Demo environment prepared: .env in the worktree (gitignored) with DB_PORT=5436, since 5432-5435 are held by four orphaned containers from earlier lanes. APP_PORT=3000.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
