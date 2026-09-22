# Feature Specification: Session auth for operator and invited players

**Feature Branch**: `task-0014-session-auth`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Session auth for operator and invited players: user and session tables with migrations, modern password hashing, sign-in/sign-out/session-validation over HTTP with secure cookies, an operator provisioning path on a fresh install, a player invite flow, and a validateSession seam callable from both the HTTP middleware and the WebSocket upgrade handler."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and stay signed in (Priority: P1)

Someone with an account proves who they are once, and stays recognized across
requests and page reloads until they sign out or enough time passes. Presenting
the wrong credentials never gets them in.

**Why this priority**: Without this nothing else in the feature is reachable, and
the M0 demo requires two distinct signed-in people. It is also the only story
whose absence makes the others meaningless: an invite that cannot be redeemed by
signing in has delivered nothing.

**Independent Test**: Create an account, sign in with the right credentials, make a
subsequent request and be recognized; sign in with wrong credentials and be
refused. Delivers a usable single-account login on its own.

**Acceptance Scenarios**:

1. **Given** an account exists, **When** its owner presents the correct credentials,
   **Then** they are signed in and a later request in the same browser is recognized
   as them without presenting credentials again.
2. **Given** an account exists, **When** someone presents the wrong password,
   **Then** they are refused, and the refusal does not reveal whether the account
   exists.
3. **Given** no such account exists, **When** someone attempts to sign in,
   **Then** they are refused with the same response as a wrong password.
4. **Given** a signed-in person, **When** they reload the page, **Then** they are
   still signed in.
5. **Given** a signed-in person, **When** they sign out, **Then** the next request
   is not recognized, and the credential they held before is no longer usable.

---

### User Story 2 - One identity, recognized on every channel (Priority: P1)

A signed-in person opens a live connection, and the system recognizes them there
as the same person it recognizes on ordinary requests — same identity, same
permissions, one place where that judgment is made.

**Why this priority**: Equal to US1 because it is the seam another task consumes.
The live connection must filter what each viewer may see, and it cannot do that
without a viewer identity. Two separately-written validations are how the two
drift: one gets an expiry fix the other does not, and a signed-out person keeps
receiving events.

**Independent Test**: Sign in, open a live connection carrying the same session,
confirm it resolves to the same identity the ordinary request path resolves. Then
sign out and confirm a new connection attempt is refused.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** they open a live connection, **Then** it
   resolves to the same identity and role their ordinary requests resolve to.
2. **Given** a session that has been signed out, **When** a live connection presents
   it, **Then** it is refused.
3. **Given** an expired session, **When** it is presented on either channel,
   **Then** both refuse it identically.
4. **Given** a live connection that polls continuously, **When** the session's
   lifetime would otherwise elapse, **Then** validating it does not silently extend
   it.

---

### User Story 3 - The operator gets in on a fresh install (Priority: P2)

Someone who has just installed the system on their own machine creates the first
account by a documented path, with no pre-seeded credential to change and nothing
to guess.

**Why this priority**: A self-hosted system with no way to create its first account
is unusable, but it ranks below signing in because it happens once per install and
is a narrower path than the one every person uses every day.

**Independent Test**: Against a database with no accounts, follow the documented
path, then sign in as the resulting operator.

**Acceptance Scenarios**:

1. **Given** a fresh install with no accounts, **When** the operator follows the
   documented provisioning path, **Then** an operator account exists and can sign in.
2. **Given** an install that already has an operator, **When** the provisioning path
   runs again, **Then** it does not silently replace or duplicate the existing
   operator.
3. **Given** a fresh install, **When** nobody has run provisioning, **Then** no
   account exists that anyone could sign in as — no default credential ships.

---

### User Story 4 - The operator invites a player (Priority: P2)

The operator invites someone to their table. That person accepts, sets their own
password, and signs in. Nobody else can use that invitation.

**Why this priority**: The M0 demo needs two distinct signed-in people, and only the
operator exists without this. It ranks with provisioning rather than above it
because an invite is worthless until an operator exists to send it.

**Independent Test**: As the operator, create an invitation; redeem it as a new
person; sign in as them. Then attempt to redeem the same invitation again and be
refused.

**Acceptance Scenarios**:

1. **Given** a signed-in operator, **When** they create an invitation, **Then** they
   receive something they can hand to one person.
2. **Given** a valid unredeemed invitation, **When** someone redeems it with a
   password of their choosing, **Then** a player account exists that can sign in.
3. **Given** an invitation that has already been redeemed, **When** someone tries to
   redeem it again, **Then** they are refused and no second account is created.
4. **Given** an expired invitation, **When** someone tries to redeem it, **Then**
   they are refused.
5. **Given** a signed-in player (not the operator), **When** they try to create an
   invitation, **Then** they are refused.

---

### Edge Cases

- What happens when someone presents a credential that was never issued, or a
  well-formed one that has been tampered with? Refused exactly as an expired one is
  — a caller must not be able to tell the cases apart, because the difference is an
  oracle for probing which credentials exist.
- What happens when someone signs out twice? The second sign-out succeeds and
  changes nothing; signing out is idempotent.
- What happens when the same person signs in from two browsers? Both work
  independently, and signing out of one does not sign out the other.
- What happens when a session's lifetime elapses while a live connection is open?
  Validating on the next attempt refuses. Existing open connections are not this
  feature's concern to sever; the live-connection task owns that.
- What happens when the datastore is unreachable during validation? That is not
  "not signed in" — it is a failure the caller must distinguish, because treating it
  as unauthenticated would sign everyone out during a database blip.
- What happens when two people redeem one invitation simultaneously? Exactly one
  succeeds; the other is refused as already-redeemed.
- What happens when a password is very long? It is accepted or refused on a stated
  bound, never silently truncated to a shorter one that still authenticates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store credentials such that the stored form cannot be
  reversed to recover the original secret.
- **FR-002**: System MUST distinguish two roles: the operator who runs the install,
  and invited players.
- **FR-003**: System MUST let a person exchange correct credentials for a session
  that authenticates later requests without re-presenting those credentials.
- **FR-004**: System MUST refuse incorrect credentials with a response that does not
  disclose whether the account exists.
- **FR-005**: System MUST let a signed-in person end their session, after which the
  ended session authenticates nothing.
- **FR-006**: System MUST expire sessions after a bounded lifetime, and MUST refuse
  an expired session identically to an unknown one.
- **FR-007**: System MUST expose **one** session-validation operation, used by both
  the ordinary request path and the live-connection path, returning the identity and
  role, or nothing.
- **FR-008**: The validation operation MUST NOT extend a session's lifetime as a side
  effect.
- **FR-009**: System MUST distinguish "this session is not valid" from "validation
  could not be performed", so a datastore failure is never reported as a valid
  refusal.
- **FR-010**: System MUST carry the session credential in a way that client-side
  scripts cannot read and that is not sent to other sites.
- **FR-011**: System MUST provide a documented path to create the first operator
  account on an install that has none, and MUST NOT ship any default or pre-seeded
  credential.
- **FR-012**: System MUST let the operator — and only the operator — create an
  invitation that one person can redeem once.
- **FR-013**: System MUST refuse redemption of an invitation that is already
  redeemed or expired, and MUST create exactly one account when two redemptions race.
- **FR-014**: System MUST let a redeeming person set their own password, never
  assigning one to them.
- **FR-015**: System MUST store user and session state through a committed, versioned
  migration, applied by the same documented command the rest of the schema uses.
- **FR-016**: System MUST state a maximum accepted credential length and MUST NOT
  silently truncate a longer one.
- **FR-017**: Automated tests MUST cover a successful sign-in, refusal of wrong
  credentials, refusal of an expired session, and single-use invitation redemption.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to authenticate and act
  through the same validation seam and the same endpoints a human uses, with no
  human-only path. Nothing in this feature may require a rendered page to complete.
- **CR-002** (III. Data planes): User, session, and invitation state belongs to the
  session plane. This feature MUST NOT read or write library or codex state.
- **CR-003** (IV. Server authority): Identity MUST be decided by the server. A client
  MUST NOT be able to assert who it is, and the credential MUST NOT be forgeable
  from anything a client holds.
- **CR-004** (VIII. Operator-owned content): This feature MUST NOT ship, seed, or
  reproduce rulebook content of any kind.
- **CR-005** (IX. Self-hostable): Authentication MUST work on the project's own
  datastore with no external identity provider and no managed service.

### Key Entities *(include if feature involves data)*

- **User**: someone who can sign in. Carries a stable identifier, a display name, a
  role (operator or player), and the irreversible form of their password. The
  operator is a user whose role differs, not a separate kind of thing.
- **Session**: one signed-in browser's continuing recognition. Carries a stable
  identifier, the user it belongs to, when it expires, and when it was created. A
  user may hold several independently.
- **Invitation**: the operator's one-time offer of an account. Carries something the
  recipient presents, who it was issued by, when it expires, and whether it has been
  redeemed. Once redeemed it is spent forever.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person who signs in stays recognized across page reloads for the full
  session lifetime without re-entering credentials.
- **SC-002**: The same session presented to an ordinary request and to a live
  connection resolves to the same identity and role, 100% of the time — one
  validation path, so divergence is not possible by construction.
- **SC-003**: A wrong password and a nonexistent account are indistinguishable to the
  caller: same response shape, same disclosure, no timing or message that separates
  them.
- **SC-004**: An operator reaches a working first account on a fresh install by
  following one documented path, with zero pre-seeded credentials anywhere in the
  system.
- **SC-005**: An invitation can be redeemed exactly once. Under simultaneous
  redemption attempts, exactly one account is created.
- **SC-006**: A signed-out or expired session authenticates nothing on either
  channel, on the next attempt.
- **SC-007**: A continuously-polling live connection does not keep a session alive
  past its lifetime.

## Assumptions

- **"Session" here means a sign-in session, not a game session.** These are
  different concepts sharing an English word, and both exist in this product. The
  event log's `session_id` is a *play* session (architecture A4, spec 004); this
  feature's sessions are authentication state. Naming and schema must keep them
  distinct — a table named `sessions` without qualification is a trap.
- **Single-tenant.** One operator per install, per the constitution's auth row.
  Multiple operators, org structures, and tenancy are out of scope.
- **The invitation is delivered by the operator, not the system.** No email is sent;
  there is no mail infrastructure in M0 and adding one would be a new dependency the
  Architecture Constraints table does not carry. The operator hands over the
  invitation by whatever means they already use.
- **Password reset and account recovery are out of scope.** A single-tenant
  self-hosted install has no support desk, and the operator has database access.
  Recovery is a later milestone's concern.
- **Rate limiting and lockout are out of scope for M0**, and recorded here rather
  than silently omitted: a self-hosted single-tenant install is not exposed to
  credential stuffing the way a public service is. The seam to add it later is the
  sign-in path.
- **Sessions are stored server-side rather than self-contained.** FR-005 requires
  that signing out makes a session authenticate nothing, which a self-contained
  token cannot do before it expires without a revocation list — which is server-side
  state anyway.
- **The event log's actor identifier is this feature's user identifier.** Spec 004
  deliberately left `actor` an opaque identifier with no foreign key, precisely so
  this feature could supply its meaning without reshaping that table.
