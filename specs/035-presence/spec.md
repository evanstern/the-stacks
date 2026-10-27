# Feature Specification: Presence — who is at the table

**Feature Branch**: `task-0051-presence`

**Created**: 2026-10-26

**Status**: Draft — stopped at operator checkpoint C2 (frame ruling) before `plan.md`

**Input**: Board task TASK-0051: "Every connected client sees who is at the table, and the gate
and the Director know which players are present." Carriage (protocol frame or session event)
is decided by a decision record first; the draft is `decision-draft.md` in this directory.

**Card acceptance criteria → this spec**

| Card AC | Covered by |
|---|---|
| #1 A decision record states how presence is carried and why | FR-001, `decision-draft.md` (moves to `backlog/decisions/` after the C2 ruling, and merges in this task's PR) |
| #2 Every connected client sees the present players and the DM | User Story 1, FR-002–FR-007 |
| #3 A disconnect updates presence within a stated timeout | User Story 2, FR-008–FR-011, SC-002 |
| #4 The gate and the Director read presence through one server-side interface | User Story 3, FR-012–FR-016 |
| #5 Tests cover join, leave and reconnect | FR-017, SC-004 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who is at the table (Priority: P1)

A player opens a table. A presence strip shows every person connected to that table right now:
the DM and each player, marked by their role at the table. When a second player opens the same
table, both players see the newcomer appear without reloading.

**Why this priority**: every other part of this task, and both consumers (TASK-0049 group
sign-off, the Director), depends on the server knowing who is connected. The visible strip is
the part a human can check.

**Independent Test**: open one table in two Brave sessions signed in as two different users.
Each session shows both users as present. This is the runbook's merge condition for TASK-0051.

**Acceptance Scenarios**:

1. **Given** player A has the table open, **When** player B opens the same table, **Then** A's
   strip shows B as present within 2 seconds, and B's strip shows A and B.
2. **Given** the DM seat is the AI DM, **When** any viewer opens the table, **Then** the strip
   shows the AI DM as present.
3. **Given** user H holds the human DM seat, **When** H has the table open, **Then** every
   viewer's strip shows H as the DM, present; **When** H has it closed, **Then** the strip shows
   the DM seat as held by H and absent.
4. **Given** user O is connected but controls no party character and holds no DM seat, **Then**
   the strip shows O as an observer, not as a player.
5. **Given** user A has the table open in two tabs, **Then** the strip shows A once.

---

### User Story 2 - Leaving updates the table (Priority: P1)

When a player closes the tab, loses the network, or their laptop sleeps, every other viewer sees
that player go absent within a stated time. A brief reconnect (a page reload, a network blip)
does not flash the player out and back in.

**Why this priority**: presence that never clears is worse than none — the gate would wait for
sign-off from someone who has gone.

**Independent Test**: with A and B at the table, close B's tab. A's strip shows B absent within
the clean-leave bound. Separately, cut B's network without closing the socket; A's strip shows
B absent within the silent-loss bound.

**Acceptance Scenarios**:

1. **Given** A and B are present, **When** B closes their last tab for the table, **Then** A's
   strip shows B absent within 10 seconds.
2. **Given** A and B are present, **When** B's connection is lost without a close, **Then** A's
   strip shows B absent within 30 seconds.
3. **Given** A and B are present, **When** B reloads the page and reconnects within the grace
   period, **Then** A's strip never shows B absent.
4. **Given** B has two tabs open, **When** B closes one, **Then** B stays present.
5. **Given** B subscribes to a different table on the same connection, **Then** B goes absent
   from the first table on the clean-leave bound.

---

### User Story 3 - The gate and the Director know who is present (Priority: P2)

Server code that decides on the table's behalf reads the present set from one place. The
Director receives the present players with every turn, so a later card can stop it waiting on
an absent player. The gate can ask the same question when TASK-0049 makes group sign-off count
only present players.

**Why this priority**: it is the card's stated reason for existing, but its behavioural
payoff lands in TASK-0049 and TASK-0050. This task delivers the seam and its first reader.

**Independent Test**: a unit test gives the Director's context a fake presence reader with one
of two party players absent; the assembled turn context and the turn record both name only the
present player.

**Acceptance Scenarios**:

1. **Given** party players A and B with only A present, **When** a DM turn assembles, **Then**
   the turn context lists A as present and B as absent, and the turn record stores that set.
2. **Given** a server restart, **When** no one has reconnected yet, **Then** the presence
   reader reports no human present for any table.
3. **Given** an AI actor (the AI DM or an AI companion), **Then** the presence reader always
   reports it present.

---

### Edge Cases

- **Server restart or deploy**: every socket drops. Presence restarts empty and refills as
  clients reconnect (the client already retries every second). Nothing stale survives a restart.
- **Stale client bundle after a deploy**: a tab running the previous build must not receive a
  frame it cannot parse. See FR-005.
- **DM seat change while connected**: a `dm.seat.changed` event moves the DM marker; the strip
  re-derives roles from the log, so no presence update is needed for the role to change.
- **Party change while connected**: a `party.member.changed` event moves a user between
  observer and player the same way.
- **Signed-out mid-session**: the session cookie expires but the socket stays open. Presence
  follows the socket; authentication is only checked at upgrade (unchanged).
- **One user, many tables**: presence is per table. A user present at table X is absent from
  table Y.
- **Many tabs, one closes uncleanly**: presence holds while at least one connection for that
  user and table is alive.

## Requirements *(mandatory)*

### Functional Requirements

**Carriage (card AC #1)**

- **FR-001**: Presence MUST be carried as `decision-draft.md` states once the operator rules at
  C2. The ruled record MUST land in `backlog/decisions/` in this task's PR. Requirements below
  assume the draft's recommendation (option A: a new server→client snapshot frame, opt-in on
  subscribe, presence kept out of the event log). A different ruling re-opens FR-002–FR-011.

**What is shown (card AC #2)**

- **FR-002**: The server MUST treat a user as present at a table while at least one of that
  user's authenticated connections is subscribed to that table, subject to the grace in FR-009.
- **FR-003**: The server MUST send each opted-in subscriber the full present set for its table
  once, right after the replay completes, and again whenever the set changes.
- **FR-004**: The present set MUST name each present user once, with a display name taken from
  the account record. It MUST NOT carry a role: the client derives the role from the log.
- **FR-005**: The server MUST send presence only to connections that asked for it on
  subscribe. A connection that did not ask MUST receive exactly the frames it receives today.
- **FR-006**: The play route MUST show a presence strip in the table header. The strip MUST mark
  each present user as DM, player or observer from the viewer's own projection (DM seat and
  party). It MUST show the AI DM as present whenever the seat is AI. It MUST show a human DM
  seat whose holder is absent as absent.
- **FR-007**: The strip MUST NOT use a modal. Any detail view MUST open as a slide-out panel.

**Timing (card AC #3)**

- **FR-008**: A clean leave (socket close, or a subscribe to another table) MUST make the user
  absent for every other viewer within 10 seconds.
- **FR-009**: A user whose last connection closes MUST stay present for a grace period of
  5 seconds. A reconnect inside the grace MUST cancel the leave, and no viewer sees a change.
- **FR-010**: The server MUST detect a silently lost connection with a heartbeat, and close it.
  A silent loss MUST make the user absent for every other viewer within 30 seconds.
- **FR-011**: The 5-second grace, the heartbeat interval and the 30-second bound MUST be named
  constants, stated in the `presence` wiki note, so tests and docs read one value.

**One server-side interface (card AC #4)**

- **FR-012**: The server MUST expose one presence reader. The gate, the Director and the
  gateway MUST obtain presence only through it. No other module may read the subscriber
  registry to answer "who is present".
- **FR-013**: The reader MUST answer, for a table, the set of present human user ids, and
  whether a given actor is present. Any AI actor MUST be reported present.
- **FR-014**: The DM turn context MUST carry the present set from the reader. The turn record
  MUST store the set the Director saw, so the playtest auditor can check a decision against it.
- **FR-015**: The gate MUST receive the reader as a dependency. Gate behaviour MUST NOT change in
  this task. TASK-0049 decides how group sign-off counts present players.
- **FR-016**: Presence MUST NOT write to the event log, trigger a DM turn, or reach any model
  prompt other than the Director's.

**Tests (card AC #5)**

- **FR-017**: Automated tests MUST cover: join (a second subscriber's arrival reaches the
  first); leave (a clean close reaches the others within FR-008); reconnect inside the grace
  (no absent update is sent); silent loss (a heartbeat timeout closes the socket and the user
  goes absent); multi-tab (one close keeps the user present); non-opted-in subscriber (no
  presence frame); the reader (AI actors present, restart empty).

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to read the present set through the same
  WebSocket opt-in a browser uses. The playtest harness MUST be able to drive presence through
  that path.
- **CR-006** (IV. Event-sourced play, server authority): Presence MUST be server-authoritative:
  a client cannot declare another user present. Roles shown beside presence MUST be derived from
  the log. Whether connection state outside the log satisfies "client state MUST be a
  projection of the log" is the ruling `decision-draft.md` asks the operator for.
- **CR-004** (VI. 5e engine boundary): Presence MUST NOT reach mechanics. No roll or number may
  depend on it.

CR-002 (content contract), CR-003 (citations) and CR-005 (operator-owned content) do not apply:
presence creates no content entity, draws nothing from the library, and ships no book text.

### Key Entities

- **Presence entry**: one present user at one table — user id and display name.
- **Present set**: the presence entries for one table at one moment. Ephemeral: rebuilt from live
  connections, never stored.
- **Presence reader**: the one server-side question "who is present at table T", used by the
  gateway, the gate and the Director.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In two Brave sessions on one table, each sees the other join within 2 seconds and
  leave within 10 seconds of a tab close. Screenshots of both states are in the PR.
- **SC-002**: A silently dropped connection shows as absent to the other viewers within
  30 seconds, in an automated test.
- **SC-003**: A page reload shows no absent flicker to other viewers, in an automated test.
- **SC-004**: Every scenario in FR-017 has a passing test, and `pnpm ci:check` is green.
- **SC-005**: A tab running the pre-change client stays working when connected to the changed
  server (no presence frame reaches it), in an automated test.

## Assumptions

- The server is one process. The DM worker, the gate and the gateway share memory
  (`apps/server/src/index.ts`), so an in-memory reader serves all three. A multi-process
  deployment would need a shared presence store; see open question Q4.
- The Director never waits on a human today: its `hold` waits only for AI companions
  (`apps/server/src/dm/nodes/director.ts`). "The Director must not wait on an absent player"
  becomes live when TASK-0050 (floor) and TASK-0049 (sign-off) add waits on humans. This task
  supplies the present set to the Director and records it; it does not change a Director
  decision.
- Display names come from `users.display_name`, read once at upgrade beside the identity.
- The client keeps retrying every second (`useSession`), so a reload reconnects well inside the
  5-second grace.

## Open Questions (for the operator at C2)

- **Q1 — Carriage.** Rule on `decision-draft.md`: option A (recommended), B, C or D.
- **Q2 — Constitution IV reading.** Option A keeps presence outside the log. Rule whether
  "client state MUST be a projection of the log" covers connection state. If it does, A needs a
  constitution amendment, or option B or D applies.
- **Q3 — Observers.** Should a connected user who is neither seated DM nor a party player appear
  in the strip (as "observer"), or be hidden? The spec assumes shown.
- **Q4 — Multi-process.** The in-memory reader assumes one server process. If a multi-process
  deployment is planned, card a shared presence store with that trigger (decision-0020).
- **Q5 — Absent DM.** When a human DM seat holder is absent, should anything beyond the strip
  happen (for example, the AI DM covering)? The spec does nothing beyond the strip; a behaviour
  change needs its own card.
