# Feature Specification: Invitation redeem conflict

**Feature Branch**: `task-0032-invite-conflict`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "TASK-0032 (bug): Redeeming an invitation with an already-taken
username throws a 500 instead of returning `{ok:false, reason:'conflict'}`, because
`auth/invitations.ts` `isUniqueViolation()` checks only `err.code` while drizzle wraps pg
errors (the pg error sits on `err.cause`). `library/store.ts` has the fixed copy (83ebc51).
Share one helper; prove the conflict with a real-database integration test."

## User Scenarios & Testing *(mandatory)*

The user is an invited player who picks a username that someone already holds. Today the
server answers with a generic internal error. The player cannot tell what went wrong, and
cannot fix it. The intended behavior, documented since spec 005, is a clear "that username
is already taken" answer that lets the player pick another name and try again.

### User Story 1 - A taken username is reported as a conflict (Priority: P1)

A player opens a valid invitation and chooses a username that already exists, in any letter
case. The server refuses with a conflict response that names the problem. The invitation stays
unused, so the player can redeem it again with a free username.

**Why this priority**: this is the bug. Without it, an ordinary typo-level mistake looks like
a server crash, and the operator cannot tell a real fault from a name clash.

**Independent Test**: against a real database, create a user, issue an invitation, and redeem
it with that user's username. The redeem result is `conflict` and the HTTP answer is a 409
with the conflict error shape. Then redeem the same invitation with a new username; it
succeeds.

**Acceptance Scenarios**:

1. **Given** an existing account `alice` and a valid invitation, **When** a player redeems the
   invitation with username `alice`, **Then** the result is `{ ok: false, reason: "conflict" }`.
2. **Given** an existing account `alice` and a valid invitation, **When** a player redeems the
   invitation with username `ALICE`, **Then** the result is also `conflict` (usernames are
   unique regardless of letter case).
3. **Given** the same setup, **When** the redeem goes through the HTTP route, **Then** the
   response is 409 with the conflict error kind and the message "That username is already
   taken." — never a 500.
4. **Given** a redeem that failed with `conflict`, **When** the player redeems the same
   invitation with an unused username, **Then** the redeem succeeds and creates exactly one
   account.

---

### User Story 2 - One unique-violation detector serves every caller (Priority: P2)

A maintainer who needs to detect a database unique-violation finds exactly one helper that
does it correctly. The auth and library code both call it. No second copy exists to drift.

**Why this priority**: the bug exists because two copies drifted apart. The fix is not done
while a copy remains that can drift again.

**Independent Test**: search the server source for the unique-violation error code and for
the detector's name. Exactly one definition exists, and both callers import it. A small unit
check proves the helper recognizes the code both bare and wrapped one level deep.

**Acceptance Scenarios**:

1. **Given** the server source, **When** a maintainer searches for the unique-violation code
   `23505`, **Then** it appears in exactly one source file.
2. **Given** an error whose own code is the unique-violation code, **or** whose wrapped cause
   carries that code, **When** the helper inspects it, **Then** it reports a unique-violation.
3. **Given** any other error, a non-object, `null`, or `undefined`, **When** the helper inspects
   it, **Then** it reports no unique-violation and does not throw.

### Edge Cases

- A username that differs only in letter case from an existing one is a conflict (the
  database index is case-insensitive).
- A conflict and a spent invitation at the same time: the account insert runs first, so the
  player sees `conflict`. This ordering is existing behavior and this fix does not change it.
- A failed redeem leaves no orphan account and no spent invitation (the transaction rolls
  back).
- Errors that are not unique-violations still propagate unchanged, and still surface as a 500
  with the fixed internal message.
- The library store's existing conflict behavior (duplicate book name race, duplicate
  embedding) is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (card AC #1): Redeeming an invitation with a username that already exists, in
  any letter case, MUST return `{ ok: false, reason: "conflict" }` and MUST NOT throw.
- **FR-002** (card AC #1): The redeem route MUST answer such a request with 409 and the
  conflict error shape, never a 500.
- **FR-003** (card AC #1): An integration test MUST prove FR-001 and FR-002 against a real
  database. It MUST run, not skip, when the database is required.
- **FR-004**: A redeem that fails with `conflict` MUST leave the invitation redeemable and
  MUST create no account.
- **FR-005** (card AC #2): Exactly one unique-violation helper MUST exist in the server
  source. It MUST recognize the code on the error itself and on its wrapped cause.
- **FR-006** (card AC #2): The auth invitation code and the library store MUST both use that
  helper. No other copy of the detector or of the error-code constant MAY remain.
- **FR-007**: The helper MUST return false, without throwing, for any value that does not
  carry the unique-violation code.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent redeems an invitation through the same
  `POST /auth/invitations/redeem` route and the same `redeemInvitation` function a human
  uses; the conflict answer is the same structured error for both.
- **CR-002** (III. Data planes): The shared helper MUST live outside every plane directory,
  so importing it from the library plane crosses no plane boundary.

### Key Entities

- **Unique-violation helper**: one predicate that answers "did this database write fail
  because a unique rule was broken?" for any thrown value.
- **Redeem result**: the existing `ok` / `invalid` / `conflict` outcome of redeeming an
  invitation. Its shape does not change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of redeem attempts with a taken username return a conflict answer in the
  integration suite; 0 return an internal error.
- **SC-002**: The integration suite covering redeem runs with 0 skipped tests when the
  database is required.
- **SC-003**: A search of the server source finds the unique-violation code in exactly 1
  file, and the detector defined exactly once.
- **SC-004**: All existing library store conflict tests still pass unchanged.

## Assumptions

- The fixed detector in `library/store.ts` (commit 83ebc51) is the correct behavior to share:
  check the error's own code, then its direct cause. Deeper cause chains are not needed today.
- The route-level mapping from `conflict` to a 409 already exists and is correct; only the
  detection is broken.
- No schema, migration, or response-shape change is needed.
- Clarify skipped: no ambiguity. The card names the defect, the reference fix, and both
  acceptance criteria.
