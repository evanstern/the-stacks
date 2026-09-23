---
id: TASK-0016
title: React SPA shell and the two-browser echo demo
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-23 04:38'
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

Phase 1 + US1 verified by the orchestrator independently, not accepted from the report (commit 57afc81).

T008 proven effective both directions BY RE-RUNNING IT: disabled the isReservedPath guard, 2 tests failed catching /api/* and /auth/* returning 200 (the SPA shell) instead of the structured 404; restored, 5/5 pass. This is a real regression test, not one that passes against a broken implementation.

Gates re-run with the database actually up (docker compose up -d db on DB_PORT=5436, migrations applied, env loaded via set -a):
  pnpm typecheck  clean
  pnpm lint       Checked 56 files. No fixes applied.
  pnpm test       11 files, 72/72 passed, 0 skipped
  pnpm build      vite 8.3.0, built in 74ms

The implementer's own run reported 30 passed / 42 skipped -- correct for a run without TEST_DATABASE_URL, but it proves nothing about the auth/events/ws integration suites. With the DB up all 72 execute and pass, so the SPA work breaks none of the merged server behaviour.

Implementer finding worth keeping: c.finalized does NOT flip when one middleware invokes another directly (it only reflects the outer dispatch assigning to c.res), so static.ts distinguishes hit from miss by the return value of serve(c, async () => undefined). Their first draft had this wrong and silently served the shell in place of real assets.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Scope: User Story 2 (T011-T016, sign-in + /auth/me on load) and User Story 3 (T017-T024, subscribe/replay/live/send). US4 and quickstart.md deliberately withheld -- the two-browser demo is the orchestrator's to verify.

Pre-verified for the implementer so it need not guess: TanStack Router 1.170.38 code-based API confirmed present (createRouter/createRoute/createRootRoute/RouterProvider/useParams/useNavigate/Outlet/Link), so no file-based router plugin is needed; session cookie is HttpOnly/SameSite=Lax/path=/ with Secure only over HTTPS, so it rides same-origin fetches and the WS upgrade on localhost automatically.

US4 demo infrastructure prepared and PROVEN, ahead of the implementer finishing US2/US3.

Two Chrome-for-Testing 149 instances launch on ports 9222/9223 with separate --user-data-dir profiles. Isolation was verified empirically rather than assumed: set a cookie in browser A via CDP Storage.setCookies, then read cookies from both. Present in A, absent in B -- two genuinely separate jars. Two tabs in one profile share one session cookie and could never demonstrate AC#7.

Demo session id (session_id is a uuid column, so it must be a real UUID): 44f0a6ae-c13b-41a8-a22c-29b84cbe3f60
Session cookie name: session

Launcher kept at the job tmp dir with start/stop/check verbs; browsers are stopped until the demo.

Finding while verifying the quickstart (T025): running the full test suite POLLUTES the demo database. After one 72/72 run the DB held 40 users (5 with role=operator) and 433 events -- the integration suites insert real rows.

Consequence for anyone following the quickstart afterwards: auth:create-operator correctly refuses ('An operator account already exists'), but with a password nobody knows, so the demo cannot proceed. The guard is not at fault -- the tests insert directly rather than through that script, which is why five operators coexist.

Resolution: the demo runs against a freshly reset volume (docker compose down -v), which is what the quickstart promises anyway ('from a clean clone'). Recorded because the same trap will bite the next person who runs gates and then tries to demo on the same database.

T025 (quickstart.md) done and VERIFIED by execution, not transcription. On a freshly reset volume: db:migrate applied; auth:create-operator created 'operator' non-interactively via OPERATOR_PASSWORD; signed in (200 with the operator's id); POST /auth/invitations returned a 43-char token; redeem created 'player'; GET /auth/me with the redeem cookie returned that player -- confirming redemption signs them in directly.

Also noted while verifying: the server reads APP_PORT, not PORT (config.ts:19). And serveStatic logs a non-fatal warning when apps/server/public is absent, which is the case when running dist/ directly on the host rather than from the image -- harmless, but it looks alarming in logs.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
