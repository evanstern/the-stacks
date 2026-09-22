---
id: TASK-0015
title: WebSocket gateway with event-log append and cursor replay
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 19:37'
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
- [ ] #1 Clients connect over WebSocket in the same Node process as the HTTP API
- [ ] #2 A client message is validated server-side and appended to the event log before any broadcast
- [ ] #3 All subscribers to a session receive newly appended events in seq order
- [ ] #4 A client subscribing from a seq cursor receives the events it missed, then live events, with no gaps or duplicates
- [ ] #5 Events carrying restricted visibility are filtered per viewer
- [ ] #6 Disconnect and reconnect are handled without dropping or double-delivering events
- [ ] #7 Tests cover append, fan-out, and replay from a cursor
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: Foundational (Blocking Prerequisites)
- [x] #10 Spec phase: User Story 1 — Say something and have everyone see it (Priority: P1) 🎯 MVP
- [ ] #11 Spec phase: User Story 2 — Only the server decides what happened (Priority: P1)
- [ ] #12 Spec phase: User Story 3 — Come back and miss nothing (Priority: P1)
- [ ] #13 Spec phase: User Story 4 — See only what you are meant to see (Priority: P2)
- [ ] #14 Spec phase: Polish & Cross-Cutting Concerns
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
