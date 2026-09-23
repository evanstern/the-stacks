---
id: TASK-0015
title: WebSocket gateway with event-log append and cursor replay
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-23 04:01'
labels: []
milestone: m-0
dependencies:
  - TASK-0012
  - TASK-0013
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove the realtime seam that all of M4 later rests on, per architecture A4. A client connects, sends a message, the server validates and appends it to the event log, and every subscriber receives it. Reconnect replays from a seq cursor. Authority is server-side: clients never write events directly.

Spec: specs/006-ws-gateway
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clients connect over WebSocket in the same Node process as the HTTP API
- [x] #2 A client message is validated server-side and appended to the event log before any broadcast
- [x] #3 All subscribers to a session receive newly appended events in seq order
- [x] #4 A client subscribing from a seq cursor receives the events it missed, then live events, with no gaps or duplicates
- [x] #5 Events carrying restricted visibility are filtered per viewer
- [x] #6 Disconnect and reconnect are handled without dropping or double-delivering events
- [x] #7 Tests cover append, fan-out, and replay from a cursor
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: Foundational (Blocking Prerequisites)
- [x] #10 Spec phase: User Story 1 — Say something and have everyone see it (Priority: P1) 🎯 MVP
- [x] #11 Spec phase: User Story 2 — Only the server decides what happened (Priority: P1)
- [x] #12 Spec phase: User Story 3 — Come back and miss nothing (Priority: P1)
- [x] #13 Spec phase: User Story 4 — See only what you are meant to see (Priority: P2)
- [x] #14 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 1-3 (T001-T015) dispatched to sonnet-implementer and verified. Served
model from transcript: 141 occurrences of claude-sonnet-5. 53/53 tests pass
with all three integration suites genuinely running (no skip notice).

VERIFIED LIVE by orchestrator probe -- a real HTTP server, a real gateway, real
ws clients, real Postgres. Not the implementer's tests:
  1. no cookie          -> refused HTTP 401, socket never opens
  2. bogus token        -> refused HTTP 401
  3. fan-out            -> all 3 subscribers received, sender included
  4. authority          -> a client claiming actor='SOMEONE-ELSE', seq=999,
                           ts=1999 got the CONNECTION's identity, server
                           seq=2, and a 2026 timestamp. History cannot be
                           forged from a client (FR-005, FR-006, SC-004).
  5. session isolation  -> subscriber to a different session received 0
  6. dead socket        -> killed one subscriber mid-broadcast; survivors
                           still received (FR-012, SC-007, research D5)
  7. malformed frame    -> error frame kind=validation, connection STAYED
                           OPEN, and event positions remained contiguous --
                           nothing spurious appended (FR-003, US2 scenario 4)

Code review: upgrade auth is cookie-only (never a query-string token, which
proxies log); 503 vs 401 split is implemented in its own try/catch as FR-013
requires; broadcast iterates synchronously with per-socket try/catch and NO
Promise.all, so one dead subscriber cannot fail the others; empty subscriber
sets are deleted so a long-running process does not leak an entry per session.

Implementer's flagged judgment calls, reviewed and accepted: it implemented a
minimal subscribe (live-only, no replay) and a minimal error-frame path because
the Phase 1-3 tests cannot exist without them, and left ws/subscribe.ts
uncreated for Phase 5's replay boundary (T025-T027). That is the right split --
the boundary algorithm is the one subtle piece and belongs in its own dispatch.
Phase 4's refusal TESTS (T016-T019) remain unwritten, which is correct scope.

Note: the implementer's report claimed it committed a Dispatch line. It did
not, and should not have -- backlog/ was correctly untouched (verified). The
line above is the orchestrator's, as it should be.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 4-7 (T016-T040) dispatched to sonnet-implementer and verified. Served
model from transcript: 229 occurrences of claude-sonnet-5. All 40 tasks ticked;
67/67 tests pass with every integration suite genuinely running.

THE IMPLEMENTER REPORTED A WEAKNESS HONESTLY, AND IT WAS THE MOST USEFUL PART
OF THE DISPATCH. T022 (the end-to-end replay-boundary test) caught a
reintroduced replay-then-subscribe bug only ~1 run in 7. It diagnosed why: the
vulnerable window is a SYNCHRONOUS, no-await gap between the replay loop
exiting and the registry join, so nothing in a single-threaded Node process can
interleave inside it and concurrent write pressure essentially never lands a
commit there. Raising concurrency did not improve the hit rate, which fits a
fixed tiny window rather than one proportional to load.

ORCHESTRATOR FIX (b86ff00): that diagnosis is exactly what makes a
deterministic test possible -- the window is unreachable by racing but
trivially reachable by controlling the clock. Added
apps/server/test/ws.subscribe.test.ts, which calls subscribe() directly
against a fake log and fake registry and appends DURING the replay's own
await. Verified both directions:
  correct implementation   -> 2/2 pass
  replay-then-subscribe    -> 2/2 FAIL, five runs out of five
The failure is the D1 defect made visible: received [4,1,2,3,4] instead of
[1,2,3,4] -- the mid-replay event delivered out of order AND duplicated.
Restored byte-identical; the algorithm is untouched. The seam is a DEFAULT
PARAMETER, not test-only scaffolding: production callers omit it. T022 is kept
as the end-to-end check; this is the guard that fires every time.

VISIBILITY VERIFIED LIVE by orchestrator probe, including the implementer's
flagged inference (public reaches everyone; any other value names the one
userId it reaches). Alice whispers to herself in a 3-event session:
  alice live  [1,2,3]   bob live  [1,3]   bob replay  [1,3]
  whisper hidden from bob: true | replay matches live: true | bob has gap: true
The single filtering point holds -- replay cannot be used to receive what live
delivery withheld, which is the drift that would be a disclosure bug. Bob's
gap at seq 2 is present and correct (US4 scenario 4).

Implementer's other findings, reviewed and accepted: concurrent sends from one
socket race for append's advisory lock, so send-call order is not commit order
(not a spec violation -- FR-007 promises one order for every subscriber, not
the sender's call order); test/ is outside tsconfig's include so typecheck does
not cover it (pre-existing, belongs to TASK-0017).

NOT DONE, and not claimed: quickstart step 6, the two-browser docker compose
demo. It is a shell-only dispatch with no interactive browser. That check is
TASK-0016's AC#7 and the M0 milestone itself.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup (Shared Infrastructure): 3/3 · Foundational (Blocking Prerequisites): 5/5 · User Story 1 — Say something and have everyone see it (Priority: P1) 🎯 MVP: 7/7 · User Story 2 — Only the server decides what happened (Priority: P1): 5/5 · User Story 3 — Come back and miss nothing (Priority: P1): 7/7 · User Story 4 — See only what you are meant to see (Priority: P2): 5/5 · Polish & Cross-Cutting Concerns: 8/8). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
