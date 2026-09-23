---
id: TASK-0016
title: React SPA shell and the two-browser echo demo
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-23 13:17'
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
- [x] #1 A React 19 + Vite SPA builds and is served by the app container
- [x] #2 TanStack Router and TanStack Query are wired
- [x] #3 A sign-in view authenticates against the session auth and persists the session across reload
- [x] #4 A minimal view subscribes over WebSocket and renders events from the log
- [x] #5 A user can send a message that reaches the other signed-in browser
- [x] #6 Reloading the page replays prior events from the log rather than showing an empty view
- [x] #7 The M0 demo runs end to end from docker compose up with two browsers signed in as different users
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: User Story 1 — The SPA is served by the app container (Priority: P1)
- [x] #10 Spec phase: User Story 2 — Sign in, and stay signed in across reload (Priority: P1)
- [x] #11 Spec phase: User Story 3 — Live and replayed events in one view (Priority: P1)
- [x] #12 Spec phase: User Story 4 — The two-browser demo (Priority: P1)
- [x] #13 Spec phase: Gates
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

Two demo-critical server behaviours verified by the orchestrator directly against the running server, so the implementer's claims can be checked rather than trusted:

1. Empty session: subscribe to a session with no events returns {"type":"replay-complete","throughSeq":0} immediately, with no event frames before it. The demo starts from exactly this state, so the SPA can tell 'caught up and quiet' from 'still loading' on the first subscribe. No special-casing needed.

2. Sender echo: a send produced exactly ONE event frame back to the sender (seq 1, actor = the connection's identity, not anything the client supplied). That is the server half of FR-013/SC-004. If the browser shows a message twice, the defect is client-side optimistic rendering, and this is the baseline that proves it.

Incidental finding: attempting to DELETE the probe's event was REFUSED by the database -- 'events is append-only: DELETE is not permitted' from the events_append_only() trigger. Constitution IV is enforced at the datastore, not merely by convention. Consequence: a polluted session id cannot be cleaned; use a fresh UUID instead.

Demo session id updated to eecc199a-d65f-4b05-96e2-e9721c5349b1 (the previous one now holds the probe event).

Design note worth keeping from the US2/US3 client (reviewed in the worktree before commit): FR-014 needs the client to tell a 401 upgrade refusal (sign in again) from a 503 (retry), but the browser WebSocket API deliberately never exposes a refused upgrade's HTTP status -- a non-101 response fails the connection generically (close 1006, empty reason) so page script cannot port-scan through it.

The client resolves this by probing GET /auth/me before connecting: it exercises the identical validateSession seam the upgrade does and DOES expose its status. 401 flips identity and returns to sign-in; anything else schedules a retry. Sound, and worth explaining in the PR because a reviewer will otherwise ask why a fetch precedes every socket connect.

Also reviewed and correct ahead of verification: useSession tracks the highest DELIVERED seq with Math.max and passes it verbatim as afterSeq (D4/FR-011 -- no incrementing, no contiguity assumption), and play.tsx does not optimistically append on submit, rendering only when the event frame returns (D5/FR-013). Both still to be proven in a browser.

THE M0 DEMO RAN. 8/8 checks passed in two real browsers against docker compose up -- the verification this sweep has never been able to perform.

Setup: image rebuilt with the SPA inside, full stack up, two Chrome-for-Testing instances with separate profiles (separate cookie jars, proven earlier by a CDP probe). Driven over raw CDP, so no dependency on the absent branded Chrome.

PASS  two browsers show DIFFERENT identities (alice=operator, bob=Player)
PASS  message CROSSES to the other browser
PASS  sender sees its own message EXACTLY ONCE (count=1) -- FR-013/SC-004, the defect most likely here and invisible to shell-only checks
PASS  reply crosses back the other way
PASS  RELOAD replays prior events (both browsers)
PASS  no duplicates after replay (msg=1 reply=1)
PASS  still signed in after reload -- AC#3 via GET /auth/me, no client-side identity store

Not a UI illusion: the event log holds seq 1 actor ba892bec (operator) and seq 2 actor c8804e67 (player) with the exact message texts. The messages went through Postgres.

Before that, my own gate run on a clean tree with the DB up: typecheck clean, lint 65 files, test 11 files / 72 passed / 0 SKIPPED, build ok (vite 8.3.0).

One correction to the implementer's report: it claimed gates green at commit, but pnpm typecheck FAILED on the committed tree because five leftover probe .mjs files (cross-session-probe, guard-probe, invite-race-probe, race-probe, seam-probe) were untracked in apps/server and got typechecked. Removing them made it pass. They were never committed, so the branch itself is clean -- but the claim was not reproducible as stated until the worktree was tidied.

PR opened: https://github.com/evanstern/the-stacks/pull/12 (6 commits, task-0016-spa-demo -> main).

Body carries the literal gate output (72 passed / 0 skipped, with the database up), the 8/8 demo transcript, the event-log rows proving two distinct actors, both Dispatch lines, the typecheck-claim correction, and a 'not done, and not claimed' section naming CI (TASK-0017), the untypechecked test/ dir, the absent client test framework, and the four orphaned containers.

Cannot self-merge: the auto-mode classifier refuses gh pr merge on a session's own PR, independent of the granted permission -- an agent merging its own unreviewed work is the pattern regardless of who asked. Awaiting operator.

PR #12 merge conflict resolved (merge commit 088c766). GitHub now reports mergeable=true, mergeable_state=clean, 7 commits, 25 files.

Cause: BOTH sides of the conflict were mine. The two-track landing rule puts board bookkeeping directly on main, so 16 'Update task TASK-0016' commits accumulated there while the branch still carried the claim-time snapshot of the same card, committed alongside the spec dir. Same file, two histories.

Exactly one file conflicted -- the TASK-0016 card. No source file overlapped, so the SPA work was never at risk.

Resolved to main's version because it is a strict superset: 15 checked ACs against the snapshot's 0, both Dispatch lines, and every finding recorded during verification. Status identical on both sides, so nothing about the claim changed.

Merged main in with git merge (never rebase -- the root-guard hook forbids it), then re-ran all gates unconditionally as the handoff requires: typecheck clean, lint 65 files, test 11 files / 72 passed / 0 skipped, build ok. Still green after the merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup (Shared Infrastructure): 4/4 · User Story 1 — The SPA is served by the app container (Priority: P1): 6/6 · User Story 2 — Sign in, and stay signed in across reload (Priority: P1): 6/6 · User Story 3 — Live and replayed events in one view (Priority: P1): 8/8 · User Story 4 — The two-browser demo (Priority: P1): 5/5 · Gates: 1/1). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
