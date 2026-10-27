# Feature Specification: An unseated operator views the table as a player

**Feature Branch**: `task-0118-unseated-operator-view`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0118 (M3 sweep, track B3). Side finding of the debug-view design
(`docs/design/debug-view.md`, section "Separate bug card (TASK-0118, side finding)"). Depends
on TASK-0048, merged (commit `53a78fa` is an ancestor of `origin/main` `a4aab3c`).

**Clarify**: skipped. The card, the design doc and the server rule settle every choice. The
one open choice (what an unseated operator sees with no party character) is decided below.

## Background

The server gives the DM view only to the user holding a *human* DM seat
(`apps/server/src/ws/registry.ts` `viewerFor`, the TASK-0045 ruling). Every other connection
receives player-filtered events. With an AI DM seat, the operator receives player-filtered
events too.

The `/play` client derives its own viewer in `apps/web/app/play/viewer.ts`
`viewerFor(user, projections)` (TASK-0048). It has three branches:

1. the user holds the human DM seat: DM viewer;
2. else the user controls a party character: player viewer;
3. else (unseated): the account-role fallback. An operator gets the DM viewer.

Branch 3 is the bug. An unseated operator gets DM UI (the "Pending proposals" approvals
trigger, `isDm`, the DM composer hint) over events the server filtered for a player. The
approvals list is then built from rows the operator never receives. The client claims a view
the server does not grant.

## Decision: an unseated operator is a spectator player

An unseated operator views the table exactly as an unseated player does today. This is the
**spectator player view**: the player viewer `{ role: "player", userId }` for a user who
controls no party character. It renders:

- the public transcript, scene header, mode badge and ledger;
- no "Pending proposals" trigger and no approvals panel;
- no character picker; "Action" is unavailable, with the existing hint "You control no party
  character, so you cannot declare an action.";
- the talk composer as an unseated player has it today. The gate still decides each write.

The client rule then matches the server rule exactly: DM viewer if and only if the user holds
the human DM seat. The account role no longer decides the `/play` viewer. An operator who
wants DM-only data at an AI-DM table uses the debug view (TASK-0117), not `/play`.

This adds no new UI surface. It reuses the existing unseated-player rendering, so it adds no
modal and no panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unseated operator at an AI-DM table (Priority: P1)

The operator opens `/play/<sessionId>` for a session with an AI DM seat. The operator holds no
seat and controls no party character. The operator sees the player view, with no approvals
trigger.

**Why this priority**: this is the bug the card closes (card AC #1).

**Independent Test**: derive the viewer for an unseated operator over projections with an AI
seat. Render the table with that viewer over a fixture that has pending proposals. The markup
holds no "Pending proposals" trigger.

**Acceptance Scenarios**:

1. **Given** a session with an AI DM seat and a party none of whose characters the operator
   controls, **When** the operator opens `/play`, **Then** the viewer is
   `{ role: "player", userId: <operator id> }` and the table shows no approvals trigger.
2. **Given** the same session with an empty party, **When** the operator opens `/play`,
   **Then** the viewer is the same player viewer.

### User Story 2 - Unseated operator while someone else holds the human DM seat (Priority: P1)

A different user holds the human DM seat. The operator holds no seat and controls no party
character. The operator sees the player view.

**Why this priority**: the server sends this operator player-filtered events too (card AC #3).

**Independent Test**: derive the viewer for an unseated operator over projections whose seat is
`{ kind: "human", userId: <another user> }`. It is the player viewer.

**Acceptance Scenarios**:

1. **Given** a human DM seat held by another user, **When** the unseated operator opens
   `/play`, **Then** the viewer is `{ role: "player", userId: <operator id> }`.

### User Story 3 - Existing cases keep their behaviour (Priority: P1)

The TASK-0048 cases do not change (card AC #2).

**Acceptance Scenarios**:

1. **Given** the operator holds the human DM seat, **Then** the viewer is `{ role: "dm" }`.
2. **Given** the operator controls a party character at an AI-DM table, **Then** the viewer is
   the operator's player viewer, and the composer holds that character with "Action" available.
3. **Given** a player controls a party character, **Then** the viewer is that player's viewer.
4. **Given** an unseated player, **Then** the viewer is that player's viewer.

### Edge Cases

- **Seat event not yet folded.** The projection's seat starts as `{ kind: "ai" }`. An operator
  who holds the human DM seat sees the player view until the seat event folds, then the DM
  view. Seat rows are public, so this is one render. A player already behaves this way.
- **Seat changes mid-session.** The viewer is re-derived from projections on every event, as
  today. An operator who takes or leaves the human DM seat switches view on the seat event.
- **Fixture routes.** `play/fixtures` picks its viewer from the fixture toolbar
  (`viewerForKey`). It is not touched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `/play` viewer MUST be the DM viewer if and only if the signed-in user holds
  the session's human DM seat.
- **FR-002**: Every other signed-in user MUST get the player viewer carrying that user's id,
  whatever the account role.
- **FR-003**: The table MUST NOT show the approvals trigger or panel to a player viewer. (This
  holds today; FR-002 makes it reach the unseated operator.)
- **FR-004**: The seat-holder and character-controller derivations MUST keep their TASK-0048
  results.
- **FR-005**: The viewer derivation MUST stay pure and re-derive when seat or party events
  change.
- **FR-006**: The change MUST NOT alter the server's viewer rule, the socket frames, or any
  frozen contract.

### Key Entities

- **Viewer**: `{ role: "dm" }` or `{ role: "player", userId }`, from
  `@the-stacks/session-model`. It decides which events a projection shows and whether the table
  renders DM UI.
- **DM seat**: `{ kind: "ai" }` or `{ kind: "human", userId }`, in the gate projection.

## Card acceptance criteria map

| Card AC | Requirement | Proven by |
|---|---|---|
| #1 AI DM seat, unseated operator: player view, no approvals panel | FR-002, FR-003 | `viewer.test.mjs` derivation; `table-view.test.tsx` render with no "Pending proposals" |
| #2 seat-holder and character-controller cases keep TASK-0048 behaviour | FR-004 | `viewer.test.mjs` derivation table; the existing "operator seated as a character" test, unchanged |
| #3 viewer.test covers unseated operator with AI seat and with another user's human seat | FR-001, FR-002 | `viewer.test.mjs` new rows |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested seat and party combinations, the client grants the DM view to
  exactly the users the server grants it to.
- **SC-002**: An unseated operator at an AI-DM table sees zero DM-only controls on `/play`.
- **SC-003**: All four TASK-0048 derivation cases return the same viewer as before the change.

## Assumptions

- TASK-0048's `viewerFor` is on `main` (verified: `53a78fa` is an ancestor of `a4aab3c`).
- The spectator player view needs no new copy. The existing unseated-player hint is accurate
  for an operator too.
- The debug view (TASK-0116, TASK-0117) is where an operator sees DM-only data. This card does
  not depend on it.

## Out of scope

- Any change to `apps/server/src/ws/registry.ts` or the gate.
- A way for an operator to take the DM seat from `/play`.
- The debug view itself (TASK-0117).
