---
id: TASK-0014
title: Session auth for operator and invited players
status: Done
assignee: []
created_date: '2026-09-22 06:44'
updated_date: '2026-09-22 19:17'
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
- [x] #1 User and session tables exist with migrations
- [x] #2 Passwords are stored with a modern password hash, never reversibly
- [x] #3 Sign-in, sign-out, and session validation work over HTTP with secure cookies
- [x] #4 An operator account can be provisioned on a fresh install by a documented path
- [x] #5 The operator can invite a player who can then sign in
- [x] #6 WebSocket connections can authenticate using the same session
- [x] #7 Tests cover sign-in, rejection of bad credentials, and session expiry
- [x] #8 Spec phase: Setup (Shared Infrastructure)
- [x] #9 Spec phase: Foundational (Blocking Prerequisites)
- [x] #10 Spec phase: User Story 1 — Sign in and stay signed in (Priority: P1) 🎯 MVP
- [x] #11 Spec phase: User Story 2 — One identity, recognized on every channel (Priority: P1)
- [x] #12 Spec phase: User Story 3 — The operator gets in on a fresh install (Priority: P2)
- [x] #13 Spec phase: User Story 4 — The operator invites a player (Priority: P2)
- [x] #14 Spec phase: Polish & Cross-Cutting Concerns
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

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phases 5-7 (T027-T046) dispatched to sonnet-implementer and verified. Served
model from transcript: 208 occurrences of claude-sonnet-5. All 46 tasks ticked;
40/40 tests pass with both integration suites genuinely running.

ORCHESTRATOR FIX 1 (8e8b257) -- create-operator prompted for a password BEFORE
checking whether an operator exists. The operator typed a secret that was then
discarded, and a non-interactive run (CI, provisioning script, docker compose
run) HUNG on a prompt for input that never arrives rather than failing fast.
Moved the check first; verified with stdin closed that it now refuses in 0s
with a clear message.

ORCHESTRATOR FIX 2 + A CORRECTION TO THE IMPLEMENTER'S ACCOUNT -- the
implementer reported T035 passing 5/5 against a deliberately-broken
read-then-write implementation with only 2 concurrent callers, and injected a
50ms delay to make it fail. I widened T035 to 20 racers. The more useful
finding: at 20 racers T035 STILL passes against read-then-write, 3/3. The test
that actually catches the defect is T034 (redeeming an already-redeemed
invitation), deterministically.

Why, and it is worth keeping: redemption runs inside db.transaction, so
Postgres's row lock on the invitation serializes the competing UPDATEs whether
or not the WHERE clause carries the redeemed_at IS NULL guard. The transaction
provides the mutual exclusion; the guard is what makes the LOSER notice it
lost. Without it the loser silently overwrites, surfacing as a re-redeemable
invitation rather than as two accounts. Recorded in the test comment, since a
comment claiming the wrong thing is worse than none.

SC-005 verified independently by orchestrator probe: 20 concurrent redemptions
against the real implementation, 3 runs -- exactly 1 ok, 19 refused, exactly 1
account created every time. The losers' speculative inserts roll back, so no
orphan accounts survive.

Implementer's own flagged item, reviewed and accepted: scripts/create-operator.ts
duplicates the check-then-insert logic rather than importing provisioning.ts,
because raw 'node --experimental-strip-types' cannot resolve the .js-suffixed
imports src/ uses for its compiled path. Same constraint migrate.ts documents.
Documented in both files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup (Shared Infrastructure): 4/4 · Foundational (Blocking Prerequisites): 5/5 · User Story 1 — Sign in and stay signed in (Priority: P1) 🎯 MVP: 10/10 · User Story 2 — One identity, recognized on every channel (Priority: P1): 7/7 · User Story 3 — The operator gets in on a fresh install (Priority: P2): 5/5 · User Story 4 — The operator invites a player (Priority: P2): 8/8 · Polish & Cross-Cutting Concerns: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
