# Feature Specification: WebSocket gateway with event-log append and cursor replay

**Feature Branch**: `task-0015-ws-gateway`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Prove the realtime seam that all of M4 later rests on, per architecture A4. A client connects, sends a message, the server validates and appends it to the event log, and every subscriber receives it. Reconnect replays from a seq cursor. Authority is server-side: clients never write events directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Say something and have everyone at the table see it (Priority: P1)

Someone signed in connects to a play session, sends a message, and everyone else
connected to that same session sees it — in the order it happened, the same order
for everyone.

**Why this priority**: This is the milestone demo. It is also the first end-to-end
proof that the event log, the auth seam, and the live connection compose into a
working whole rather than three parts that pass their own tests.

**Independent Test**: Connect two clients to one session, send from one, observe it
arrive at the other. Delivers a working realtime channel on its own.

**Acceptance Scenarios**:

1. **Given** two clients connected to the same session, **When** one sends a message,
   **Then** the other receives it, and the sender's own client receives it too — one
   path for everyone, so nobody's view is assembled differently.
2. **Given** several clients sending at once, **When** all the messages arrive,
   **Then** every client sees the same events in the same order.
3. **Given** a client connected to session A, **When** a message is sent in session B,
   **Then** the client in session A does not receive it.
4. **Given** a message has been delivered, **When** the log is read afterwards,
   **Then** the message is there — delivery and durability are the same act, not two.

---

### User Story 2 - Only the server decides what happened (Priority: P1)

A client asks for something to happen. The server decides whether it did, records it,
and tells everyone. A client cannot place an event into the log directly, cannot choose
its position, and cannot claim to be someone else.

**Why this priority**: Equal to US1 because it is the property that makes the log
trustworthy. A log any client can write to is not a record of what happened; it is a
collection of claims. Retrofitting authority onto a permissive channel means rewriting
every client.

**Independent Test**: Send a well-formed request and see it recorded. Then send
malformed input, input claiming a different actor, and input specifying its own
position — and see each refused without anything being written.

**Acceptance Scenarios**:

1. **Given** a connected client, **When** it sends a message whose shape the server does
   not accept, **Then** nothing is appended and the client is told it was refused.
2. **Given** a connected client, **When** it sends a message claiming to be from another
   person, **Then** the recorded event carries the identity the connection authenticated
   as, not the claimed one.
3. **Given** a connected client, **When** it tries to specify an event's position or
   timestamp, **Then** the server assigns both and ignores what the client sent.
4. **Given** a refused message, **When** the session's stream is read afterwards,
   **Then** there is no gap and no trace of the refused attempt.

---

### User Story 3 - Come back and miss nothing (Priority: P1)

A client that was disconnected — a closed laptop, a dropped connection, a reload —
reconnects, says where it left off, and receives everything it missed, in order,
before it starts receiving new events. Nothing is skipped and nothing arrives twice.

**Why this priority**: P1 because "reload replays prior events rather than showing an
empty view" is part of the milestone demo, and because reconnect is the normal
condition of a browser, not an exception. A gap here is invisible in testing and
catastrophic in play: a player silently misses what happened while they reconnected.

**Independent Test**: Connect, receive some events, disconnect, have more events
happen, reconnect from the last position seen — and receive exactly the missed ones,
then live ones, with no duplicates.

**Acceptance Scenarios**:

1. **Given** a client that has seen up to position N, **When** it reconnects from N,
   **Then** it receives every event after N in order, and none at or before N.
2. **Given** a client reconnecting, **When** new events occur while its replay is still
   being delivered, **Then** it receives those too, after the replayed ones, with no
   gap and no duplicate at the boundary.
3. **Given** a client that has missed nothing, **When** it reconnects from the newest
   position, **Then** it receives no replayed events and is simply live.
4. **Given** a client connecting for the first time with no position, **Then** it
   receives the session's history from the beginning.

---

### User Story 4 - See only what you are meant to see (Priority: P2)

Some events are hidden from some people. Each connected person receives the events
they are entitled to, and never receives the ones they are not — not hidden in the
client, not delivered and then filtered: never sent.

**Why this priority**: The mechanism must exist from the start because it is not
retrofittable — an event already delivered cannot be un-delivered, and a client that
received hidden information has it regardless of what the interface shows. It is P2
only because M0's demo does not exercise hidden information; the capability must be
correct, not exercised.

**Independent Test**: Append events with differing visibility, connect as two people
with different entitlements, and confirm each receives only their own set.

**Acceptance Scenarios**:

1. **Given** an event marked visible to everyone, **When** it is delivered, **Then**
   every subscriber to that session receives it.
2. **Given** an event restricted to a particular person, **When** it is delivered,
   **Then** only that person's connections receive it and other subscribers receive
   nothing in its place.
3. **Given** a replay after reconnect, **When** the missed events are delivered,
   **Then** the same visibility rules apply — replay is not a way to receive what live
   delivery would have withheld.
4. **Given** a filtered stream, **When** a recipient reads the positions it received,
   **Then** the positions may have gaps, and those gaps are not treated as missing
   events by the client's own cursor tracking.

---

### Edge Cases

- What happens when someone connects without a valid session? The connection is
  refused. An unauthenticated connection is never opened and then closed after a
  message; it does not open.
- What happens when a session expires while a connection is open? The connection is
  not retroactively severed in M0 — but any new connection is refused, and this is
  recorded rather than left ambiguous.
- What happens when a client sends faster than the server can append? Messages are
  processed in the order received on that connection; the log's own ordering decides
  what position each takes. A client's own messages never overtake each other.
- What happens when the same person connects from two browsers? Both receive
  everything they are entitled to, independently. One disconnecting does not affect
  the other.
- What happens when a client asks to replay from a position beyond the newest? It
  receives nothing and is live — the same normal answer the log gives (spec 004 FR-009).
- What happens when a client asks to replay an enormous history? Replay is delivered in
  bounded batches rather than one unbounded response, so one reconnecting client cannot
  exhaust the server's memory.
- What happens when the database is unreachable at connect time? The connection is
  refused with a server-side failure, not treated as an authentication failure —
  those are different and a client should retry differently.
- What happens when a subscriber's connection dies mid-broadcast? The other subscribers
  still receive the event; one dead socket does not fail the fan-out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept WebSocket connections in the same process that serves
  the HTTP API.
- **FR-002**: System MUST authenticate a connection using the same session mechanism
  HTTP requests use, through the single shared validation seam, and MUST refuse a
  connection presenting no valid session.
- **FR-003**: System MUST validate every client message against a declared shape before
  acting on it, and MUST refuse anything that does not conform.
- **FR-004**: System MUST append a validated message to the session's event log **before**
  broadcasting it, so nothing is delivered that was not recorded.
- **FR-005**: System MUST record the actor as the identity the connection authenticated
  as, ignoring any actor the client asserts.
- **FR-006**: System MUST assign each event's position and timestamp itself, ignoring any
  supplied by a client.
- **FR-007**: System MUST deliver events to every subscriber of that session in ascending
  position order.
- **FR-008**: System MUST NOT deliver a session's events to subscribers of a different
  session.
- **FR-009**: System MUST accept a cursor at subscribe time and deliver every event after
  it before delivering newly appended ones, with no gap and no duplicate at the boundary.
- **FR-010**: System MUST deliver replay in bounded batches, never as one unbounded
  response.
- **FR-011**: System MUST filter events per recipient according to each event's visibility,
  and MUST apply the same filtering to replayed and live events alike.
- **FR-012**: System MUST tolerate a subscriber disconnecting at any time, including
  mid-broadcast, without failing delivery to other subscribers.
- **FR-013**: System MUST refuse a connection when validation cannot be performed (for
  example the datastore is unreachable) distinctly from refusing an invalid session.
- **FR-014**: System MUST NOT expose any path by which a client writes to the event log
  other than through server validation.
- **FR-015**: Automated tests MUST cover append-on-message, fan-out to multiple
  subscribers, replay from a cursor, refusal of unauthenticated connections, and
  refusal of malformed messages.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to connect, subscribe, send, and
  replay through exactly the same protocol a human's browser uses. The AI DM is just
  another actor (A4), so no capability may be reachable only from a rendered interface.
- **CR-002** (III. Data planes): This feature reads and writes session-plane state only.
- **CR-003** (IV. Event sourcing, server authority): Every mutation passes through the
  server, which validates before appending; clients receive projections of the log and
  never write to it directly. Events carry visibility, filtered per viewer at projection
  time. Unknown event types MUST be delivered, not dropped.
- **CR-004** (VI. System-agnostic): The gateway MUST NOT interpret event payloads or
  assume any game system. It validates the envelope and delegates meaning.
- **CR-005** (VIII. Operator-owned content): Ships no rulebook content.
- **CR-006** (IX. Self-hostable): Runs in the single Node process the compose stack
  already starts; no broker, queue, or external realtime service.

### Key Entities *(include if feature involves data)*

- **Connection**: one client's live link to the server. Carries the identity it
  authenticated as, the play session it subscribes to, and the position it has been
  delivered up to. It owns no state the log does not already hold — a connection can be
  lost and rebuilt from its cursor.
- **Subscription**: the association between a connection and a play session. What makes
  a connection receive that session's events and no others.
- **Client message**: a request from a client for something to happen. Not an event: it
  becomes one only if the server validates and appends it. The distinction is the whole
  of US2.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A message sent by one connected client appears at every other subscriber of
  that session, 100% of the time, with no subscriber receiving a different order.
- **SC-002**: Every delivered event exists in the log — there is no event a client saw
  that a later read cannot find.
- **SC-003**: A client reconnecting from any position receives exactly the events after
  it: zero missed, zero duplicated, including events appended during the replay itself.
- **SC-004**: No client message results in a log entry that differs from what the server
  decided — actor, position, and timestamp are the server's in 100% of records.
- **SC-005**: A recipient never receives an event whose visibility excludes them, on
  either the live or the replay path.
- **SC-006**: An unauthenticated connection attempt never receives a session's events.
- **SC-007**: With a subscriber disconnecting mid-broadcast, every remaining subscriber
  still receives the event.
- **SC-008**: **Two browsers signed in as different people exchange a message through
  the event log, and reloading either one replays the prior events.** This is the M0
  milestone demo's realtime half.

## Assumptions

- **"Session" is used in both senses here and they are kept distinct.** A *play* session
  is what events belong to (spec 004's `session_id`); an *auth* session is what a
  connection authenticates with (spec 005's `auth_sessions`). A connection has one of
  each and they are unrelated.
- **The event log's append and cursor-read seam is consumed as given.** Spec 004 fixed
  it in a contract; this feature does not reimplement ordering, gaplessness, or
  race-safety, and does not read the `events` table directly.
- **Session validation is consumed through spec 005's single seam.** This feature does
  not parse tokens, read the users table, or implement its own expiry check. It extracts
  the token from the upgrade request and calls the seam.
- **Play sessions are not yet created or managed anywhere.** No session registry exists
  (spec 004 left `session_id` opaque). For M0 a client subscribes to a session identifier
  it already knows; creating, listing, and joining sessions is a later milestone.
- **Fan-out is in-process.** Architecture A2 specifies one Node process, so subscribers
  are held in memory. A multi-process deployment would need a broker; that is out of
  scope and the seam to add one is the fan-out step.
- **Visibility semantics are minimal in M0**: an event is visible to everyone, or to one
  named person. Richer rules (per-role, per-group, revealed-later) come with the features
  that need them; the field and the filtering point exist now so they are not retrofitted.
- **No message history is held in memory.** Replay reads the log. An in-memory ring buffer
  would be a cache with its own invalidation problem and no M0 driver.
