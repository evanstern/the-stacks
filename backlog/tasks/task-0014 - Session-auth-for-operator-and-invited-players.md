---
id: TASK-0014
title: Session auth for operator and invited players
status: In Progress
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 18:51'
labels: []
milestone: m-0
dependencies:
  - TASK-0012
  - TASK-0013
documentation:
  - docs/design/architecture.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the self-rolled, Lucia-style session auth from architecture A1. Single-tenant and self-hosted: one operator account plus players the operator invites. No external identity provider. The M0 demo needs two distinct signed-in users, so this task must support at least two real accounts.

Spec: specs/005-session-auth
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 User and session tables exist with migrations
- [ ] #2 Passwords are stored with a modern password hash, never reversibly
- [ ] #3 Sign-in, sign-out, and session validation work over HTTP with secure cookies
- [ ] #4 An operator account can be provisioned on a fresh install by a documented path
- [ ] #5 The operator can invite a player who can then sign in
- [ ] #6 WebSocket connections can authenticate using the same session
- [ ] #7 Tests cover sign-in, rejection of bad credentials, and session expiry
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: Foundational (Blocking Prerequisites)
- [x] #10 Spec phase: User Story 1 — Sign in and stay signed in (Priority: P1) 🎯 MVP
- [x] #11 Spec phase: User Story 2 — One identity, recognized on every channel (Priority: P1)
- [ ] #12 Spec phase: User Story 3 — The operator gets in on a fresh install (Priority: P2)
- [ ] #13 Spec phase: User Story 4 — The operator invites a player (Priority: P2)
- [ ] #14 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 1-4 (T001-T026) dispatched to sonnet-implementer and verified by the
orchestrator. Served model from transcript: 186 occurrences of claude-sonnet-5.
35/35 tests pass with both integration suites genuinely running.

SEAM VERIFIED INDEPENDENTLY (this is what TASK-0015 depends on) -- direct probe
against the built output, not the implementer's tests:
  1. live session      -> {userId, role}
  2. arity             -> 1 (one string arg; no Request, no socket, no cookie)
  3. expiry unchanged after 5 validations -> true (no sliding renewal, FR-008)
  4. unknown token     -> null
  5. malformed token   -> null
  6. after sign-out    -> null
The same null for every failure, so it cannot be used as an oracle.

SC-003 verified by measurement, not inspection: wrong-password-on-a-real-account
and unknown-username return BYTE-IDENTICAL bodies, both 401, with overlapping
timings (~94-124ms both cases, 5 samples each). The dummy-hash verification is
working -- without it, unknown-username would return in microseconds while
wrong-password paid the 63ms scrypt cost, leaking the account list.

Cookie verified: HttpOnly, SameSite=Lax, Max-Age=2592000, Path=/, and NO Secure
over plain HTTP (the conditional behavior that keeps localhost working).

CONTRACT QUESTION RESOLVED (implementer correctly stopped to ask rather than
assume): createValidateSession(db) returns a closure whose signature is exactly
the frozen (token: string) => Promise<identity | null>. Confirmed by probe
(arity 1). Recorded in the contract as CONFORMING, not a change.

ORCHESTRATOR FIX (cc375f1): the implementer reported db:migrate failing from
the host and was right -- DATABASE_URL is the container's address but
db:migrate is a host command in both quickstarts. My Lane 3 fix was half-done:
tests got a host-reachable variable, the migrator did not. Fixed with the same
precedence. That alone would have broken the container, since compose passes
the whole .env through env_file and TEST_DATABASE_URL leaked in -- blanked it
explicitly in compose and used || rather than ?? so the blank falls through.
Spec 004's quickstart carried the same broken command and was fixed too.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
