# Feature Specification: Database foundation — Drizzle, migrations, and the session event log

**Feature Branch**: `task-0012-event-log`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Database foundation: Drizzle ORM wiring, versioned migrations, and the append-only session event log keyed (session_id, seq) with actor, type, payload, visibility, ts and a payload schema version, plus race-safe append and tests for append and ordered cursor read-back."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a session's happenings and replay them in order (Priority: P1)

A play session produces a stream of things that happened: someone narrated, someone
spoke, someone rolled. Each one is recorded in the order it occurred and can be read
back later in that same order, starting from any point a reader left off.

**Why this priority**: This is the feature. A session IS its event log, so the ability
to append a happening and read the stream back in order is the whole deliverable —
every later capability (live subscription, reconnect, agent context, projections) is
this one capability viewed differently. Nothing else in this feature has value without it.

**Independent Test**: Append several events to one session, then read from the origin
cursor and confirm the same events come back in the order they were appended. Delivers
a durable, replayable session record on its own.

**Acceptance Scenarios**:

1. **Given** a session with no recorded events, **When** an event is appended, **Then**
   it receives the first sequence position and is readable from the origin cursor.
2. **Given** a session with events at positions 1 through 5, **When** a reader reads
   from cursor 3, **Then** it receives events 4 and 5 in that order and nothing else.
3. **Given** a session with events, **When** a reader reads from a cursor at or beyond
   the newest event, **Then** it receives an empty result rather than an error.
4. **Given** an event has been recorded, **When** anything attempts to alter or remove
   it, **Then** the attempt does not succeed and the recorded event is unchanged.

---

### User Story 2 - Stand up the schema on a fresh database (Priority: P2)

A self-hoster with an empty database brings the schema into existence by running one
documented command, and gets the same schema anyone else running the same version gets.

**Why this priority**: Self-hosting is the product's premise, and an event log nobody
can create is not usable. It ranks below the log itself because it is the delivery
path for US1's value rather than the value.

**Independent Test**: Point the command at an empty database, run it, and confirm the
event log table and its constraints exist in the expected shape. Run it a second time
and confirm it neither fails nor duplicates work.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the documented migration command runs, **Then**
   the event log schema exists with its keys and constraints in place.
2. **Given** a database already at the current schema, **When** the migration command
   runs again, **Then** it completes without error and changes nothing.
3. **Given** a migration set under version control, **When** two people apply it to
   separate empty databases, **Then** both databases reach an identical schema.

---

### User Story 3 - Append safely while several writers act at once (Priority: P2)

Several participants act in the same session at the same moment. Every action is
recorded exactly once, and the resulting order is a single unbroken run that every
reader agrees on.

**Why this priority**: Concurrency is the normal condition at a table, not an edge
case — the demo itself has two browsers acting on one session. A log that loses or
duplicates a position under simultaneous writers cannot be replayed, which silently
breaks US1 rather than failing loudly.

**Independent Test**: Drive many simultaneous appends at one session, then read the
whole stream back and confirm the count matches the number of appends and the
positions form an unbroken run with no repeats.

**Acceptance Scenarios**:

1. **Given** many writers appending to one session simultaneously, **When** all appends
   complete, **Then** every append is recorded exactly once.
2. **Given** the same concurrent appends, **When** the stream is read back, **Then**
   sequence positions form an unbroken ascending run with no gaps and no duplicates.
3. **Given** writers appending to two different sessions simultaneously, **When** the
   appends complete, **Then** each session's positions are numbered independently of
   the other's.

---

### User Story 4 - Carry who may see an event, and which shape it has (Priority: P3)

Some happenings are hidden from some participants, and the recorded shape of a payload
changes as the product evolves. Every event carries both facts, so a later reader can
filter per viewer and can recognize a shape it was not written to understand.

**Why this priority**: Both fields are load-bearing for later milestones (hidden DM
information, unrevealed map regions, schema evolution) and cost nearly nothing now,
but no M0 behavior consumes them yet. Recording them is cheap; retrofitting them onto
an append-only log already carrying real play is not.

**Independent Test**: Append events carrying different visibility markers and different
payload versions, read them back, and confirm both values survive the round trip
unaltered and an unrecognized version is still returned.

**Acceptance Scenarios**:

1. **Given** an event appended with a visibility marker, **When** it is read back,
   **Then** the marker is present and unchanged.
2. **Given** an event whose payload version is not one the reader recognizes, **When**
   the stream is read, **Then** the event is still returned rather than skipped.
3. **Given** an event appended without an explicit visibility marker, **When** it is
   read back, **Then** it carries a defined default rather than an absent value.

---

### Edge Cases

- What happens when two writers append to the same session in the same instant? Both
  are recorded, at adjacent positions, exactly once each — never sharing a position
  and never leaving one unused.
- What happens when an append fails partway? No position is consumed: a later append
  takes the position the failed one would have, so the run stays unbroken.
- What happens when a reader asks for events after a cursor that no event has reached
  yet? It receives an empty result, not an error — "nothing new" is a normal answer.
- What happens when a reader asks for events from before the first recorded event?
  It receives the stream from its beginning.
- What happens when a session has a very long history and a reader replays it from the
  origin? The read is bounded to a caller-specified maximum so one reader cannot pull
  an unbounded stream in a single request.
- What happens when the migration command runs against a database already at that
  version? It completes and changes nothing.
- What happens when an event type is one the reader has never seen? It is returned
  unchanged; recognizing types is the reader's concern, not the log's.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST record each event with a session identifier, a per-session
  sequence position, an actor, a type, a payload, a visibility marker, and a timestamp.
- **FR-002**: System MUST assign sequence positions per session, starting at a defined
  origin and increasing by exactly one, with no gaps and no duplicates within a session.
- **FR-003**: System MUST number each session's positions independently of every other
  session's.
- **FR-004**: System MUST prevent any recorded event from being altered or removed; the
  log is append-only.
- **FR-005**: System MUST carry a payload schema version on every event.
- **FR-006**: System MUST return a session's events in ascending position order,
  beginning after a caller-supplied cursor.
- **FR-007**: System MUST accept a caller-supplied maximum result size on a read and
  MUST NOT return more events than that maximum.
- **FR-008**: System MUST preserve gapless, duplicate-free ordering when several writers
  append to the same session concurrently.
- **FR-009**: System MUST return an empty result, not an error, for a read whose cursor
  is at or beyond the newest recorded position.
- **FR-010**: System MUST reproduce the full schema on an empty database through a
  committed, versioned migration set applied by a single documented command.
- **FR-011**: System MUST keep migrations ordered and safe to re-apply, so an empty
  database and an already-migrated one converge to the same schema.
- **FR-012**: System MUST return events whose type or payload version it does not
  recognize rather than omitting them.
- **FR-013**: System MUST record a default visibility marker when an append does not
  state one, so no event carries an absent visibility.
- **FR-014**: Automated tests MUST cover appending, ordered read-back from a cursor, and
  concurrent appends to a single session.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to append events to a session
  and read the stream from a cursor through the same interface a human participant's
  actions travel, with no agent-only or human-only path.
- **CR-002** (IV. Event-sourced play, server authority): The log MUST be append-only and
  ordered by `(session_id, seq)`; every event MUST carry a schema version and a
  visibility marker; readers MUST tolerate event types they do not recognize.
- **CR-003** (VI. System-agnostic): The event log MUST NOT assume 5e mechanics. Event
  types and payload contents MUST be opaque to the log, so a non-d20 system module can
  use it unchanged.
- **CR-004** (VIII. Operator-owned content): This feature MUST NOT ship, seed, or
  reproduce rulebook content of any kind.
- **CR-005** (IX. Self-hostable): The schema MUST stand up on the project's own
  datastore with no managed or external service.

### Key Entities *(include if feature involves data)*

- **Event**: one thing that happened in a session. Carries the session it belongs to,
  its position in that session's order, who or what caused it, what kind of thing it
  was, the details of it, who may see it, which shape the details take, and when it
  was recorded. Once recorded, it never changes.
- **Session**: the stream an event belongs to, identified by an opaque identifier.
  Sessions partition the log: positions are numbered within a session and never
  compared across sessions.
- **Cursor**: a reader's position in one session's stream — the last position it has
  already seen. Reading from a cursor returns what came after it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An empty database reaches the complete schema by running one documented
  command, with zero manual steps.
- **SC-002**: For every read from every cursor position, returned events are in
  ascending order with no gaps and no duplicates — 100% of reads, no exceptions.
- **SC-003**: With at least 50 writers appending to a single session simultaneously,
  every append is recorded exactly once and the resulting positions form an unbroken
  run from the origin.
- **SC-004**: A reader that stops at any position and later resumes from it observes
  every event recorded in its absence, exactly once, in order.
- **SC-005**: An event carrying an unrecognized type or payload version is still
  returned by a read, so no reader silently loses history it cannot yet interpret.
- **SC-006**: Re-running the migration command against an already-migrated database
  completes successfully and leaves the schema byte-identical.

## Assumptions

- **A session identifier is opaque in this feature.** M0 records events against a
  session identifier without requiring a session registry table; no foreign key to a
  sessions table is in scope here. Later milestones that introduce a session registry
  can add the reference without reshaping the log.
- **"Session" here means a game session, not a sign-in session.** These are different
  concepts sharing an English word. TASK-0014 owns authentication sessions; this
  feature's `session_id` is the play session from architecture A4, and the two must
  not be conflated in naming or schema.
- **Actor is recorded as an identifier, not a foreign key to users.** The user table
  arrives with TASK-0014. Recording the actor as an identifier keeps this feature
  independent, and matches architecture A4's rule that the AI DM is just another actor
  — an actor need not be a row in a users table.
- **Event payloads are opaque to the log.** Validating a payload against a system
  module is the server's job at append time (constitution IV), and the system module
  interface arrives in M3. This feature stores what it is given and guarantees order,
  durability, and immutability — not payload semantics.
- **Visibility is recorded, not yet enforced.** Filtering per viewer happens at
  projection time and belongs to TASK-0015's fan-out. This feature guarantees the
  field is present, defaulted, and returned intact.
- **No read-side caching or projection materialization is in scope.** Reads go to the
  log. Materialized projections are a later optimization with no M0 driver.
- **The existing database connection wiring is reused.** The server already opens a
  connection pool for its health probe; this feature builds on that rather than
  introducing a second connection path.
