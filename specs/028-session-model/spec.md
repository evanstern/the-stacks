# Feature Specification: First Scene — session model (talk, actions, table modes, ledger, projections)

**Feature Branch**: `task-0044-session-model`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0044 ("First Scene: session model — talk, actions, table modes,
ledger, projections"), M2 First Scene sweep, lane 2. Grounding: architecture A4, A10, A11,
A12; decision-0014, decision-0016, decision-0017, decision-0020, decision-0021; constitution
2.0.0 (principles I, III, IV, VI); the TASK-0042 engine contracts in
`specs/026-dnd5e-engine/contracts/`.

**Clarify pass**: skipped. Every open point has a default an existing artifact settles. The
vocabulary comes from decision-0016 and A12; the ledger shape comes from decision-0021 idea 2
and the engine's events contract; visibility comes from constitution IV and the M0 log's
existing `visibility` column. The defaults chosen are listed under Assumptions, and the two
choices the operator may want to revisit are listed under Open Questions.

## Context

The session event log (M0) is the only source of truth for play (decision-0017 layer 1). It
stores untyped rows: an actor, a type string, a JSON payload, a payload version and a
visibility marker. This feature gives those rows a play vocabulary and turns the log into
state:

- **Typed, versioned session events** for talk, the action lifecycle, table modes, the scene,
  the party, the journal, narration and secret trackers.
- **Mechanics events** that wrap the 5e engine's events (TASK-0042) so the log carries the
  roll ledger unchanged.
- **Projections** that fold the log into scene, party, encounter, journal, transcript and
  ledger state, per viewer.
- **A fixtures contract**: committed example event streams that the play route (TASK-0047)
  renders and the proposal gate's tests (TASK-0045) build on.

The log itself does not change: no column, no migration, no change to `append` or
`readFrom`.

The "users" of this feature are four kinds of caller. The proposal gate (TASK-0045) appends
the events. The DM runtime (TASK-0046) reads projections as turn context. The play route
(TASK-0047) renders projections for a player or a DM. A test author needs fixed example
streams. The human player and the AI DM benefit through all four.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Talk and act at the table with a typed vocabulary (Priority: P1)

A player types chatter to the table. Later the same player declares that their character
picks the lock. A companion comments on the declared action. The player commits it, the
engine resolves the roll, and the action is marked resolved. Each of these is one typed,
versioned event in the session log. The talk appears in the transcript and changes nothing
else. The action moves through declared, discussed, committed and resolved.

**Why this priority**: talk versus action is the core play contract (decision-0016). Every
other piece of this feature and every consumer card depends on the event types existing.

**Independent Test**: validate a stream of talk and action events against the schemas; fold
it; assert the transcript holds every message and the action's status sequence is declared,
discussed, committed, resolved.

**Acceptance Scenarios**:

1. **Given** an empty session, **When** a talk event and an `action.declared` event are
   validated, **Then** both parse against their versioned schemas, and a payload missing a
   required field is rejected before it reaches the log. (AC #1)
2. **Given** a declared action, **When** one `action.commented` event arrives, **Then** the
   action's status is `discussed`. (AC #1)
3. **Given** a discussed action, **When** `action.committed` and then `action.resolved`
   arrive, **Then** the action's status is `committed` and then `resolved`, and the resolved
   action links to the mechanics events it produced. (AC #1)
4. **Given** any projection state, **When** only talk events are added, **Then** every
   projection except the transcript is deeply equal to its state before. (AC #2)

---

### User Story 2 - Switch between free mode and turn mode (Priority: P1)

The Director starts combat. The table switches from free mode to turn mode, and the log
records whose turn it is. When the turn passes, the active player changes. When combat ends,
the table returns to free mode.

**Why this priority**: commit authority depends on the table mode (decision-0016). The gate
(TASK-0045) cannot enforce authority without a projected mode and active player.

**Independent Test**: fold a stream that switches free to turn, changes the active player
twice and switches back; assert the table-mode projection after each event.

**Acceptance Scenarios**:

1. **Given** a new session, **When** no table-mode event exists, **Then** the projected mode
   is free mode. (AC #3)
2. **Given** free mode, **When** a table-mode event switches to turn mode naming an active
   player, **Then** the projection shows turn mode and that player. (AC #3)
3. **Given** turn mode, **When** a table-mode event names a new active player, **Then** the
   projection shows the new player, and the event records the before and after modes.
   (AC #3, AC #6)

---

### User Story 3 - Rebuild scene, party, encounter and journal from the log alone (Priority: P1)

The DM runtime assembles a turn. It asks for the current scene, the party with each member's
hit points and conditions, the encounter's initiative order, and the journal. Every answer
comes from folding the session log; nothing else holds session state. A client that
reconnects rebuilds the same state from sequence 0.

**Why this priority**: decision-0017 layer 1 makes projections the state. TASK-0046's
`assemble` node and TASK-0047's route read nothing else.

**Independent Test**: fold a fixture stream; assert each projection's content; fold the same
stream again from sequence 0, and fold it one event at a time, and assert all three results
are deeply equal.

**Acceptance Scenarios**:

1. **Given** a stream with a scene event, party events, engine events and journal events,
   **When** it is folded, **Then** scene, party, encounter and journal projections hold the
   expected state, built from those events and nothing else. (AC #4)
2. **Given** a session log stored in the database, **When** the server replays it from
   sequence 0 twice, and also folds it one event at a time as it was appended, **Then** all
   three projection results are identical. (AC #7)
3. **Given** a stream containing an event type no schema knows, a known type at an unknown
   version, and a known type with an invalid payload, **When** it is folded, **Then** the
   fold completes, skips those three events, and counts them in its diagnostics. (AC #8)

---

### User Story 4 - Keep secret trackers from players (Priority: P1)

The Director keeps a named clock, "The cult completes the ritual", with six segments. It
advances the clock twice during the scene. The DM's projection shows the clock and its
progress. A player's projection never contains the clock, its name, or its progress, in any
projection.

**Why this priority**: hidden information is a constitution IV obligation, and secret
trackers are decision-0021 idea 4. A leak is a game-breaking spoiler.

**Independent Test**: fold the secret-tracker fixture for the DM viewer and for a player
viewer; assert the DM sees the tracker; assert the player's serialized projections contain no
tracker identifier, name or value.

**Acceptance Scenarios**:

1. **Given** a tracker event, **When** it is appended, **Then** it carries the DM-only
   visibility marker, and an attempt to append a tracker event with any other visibility is
   refused before the write. (AC #5)
2. **Given** a stream with tracker events, **When** it is folded for a player viewer,
   **Then** no projection includes the tracker, even if a tracker event in the stream carries
   a wrong visibility marker. (AC #5)
3. **Given** the same stream, **When** it is folded for the DM viewer, **Then** the trackers
   projection shows each tracker's name, segments and filled count. (AC #5)

---

### User Story 5 - Audit every number in the ledger (Priority: P2)

A player asks why the goblin hit them. The ledger shows the attack roll with its reason, each
die face, the total, the AC it was compared to, and the hit-point change with before and
after values. The DM sees the same rows plus any DM-only rolls and tracker changes.

**Why this priority**: decision-0021 idea 2 makes every number auditable. TASK-0046's audit
node and TASK-0047's ledger panel read these rows.

**Independent Test**: fold the combat fixture; assert one ledger row per roll carrying its
reason, and one row per state change carrying before and after values.

**Acceptance Scenarios**:

1. **Given** an engine roll wrapped as a mechanics event, **When** it is folded, **Then** the
   ledger row carries the roll's reason, expression, faces and total. (AC #6)
2. **Given** any state-change event, engine or session, **When** it is folded, **Then** the
   ledger row carries the event's reason and its before and after values. (AC #6)
3. **Given** a mechanics event that drops the engine's reason or before/after fields, **When**
   it is validated, **Then** it is rejected before it reaches the log. (AC #6)

---

### User Story 6 - Build the play route and the gate against fixed example streams (Priority: P2)

The play route author (TASK-0047) needs realistic sessions to render before the gate exists.
The gate author (TASK-0045) needs streams to assert authority against. Both import the same
committed fixture streams and the same projection code, without importing the server.

**Why this priority**: TASK-0047 starts against fixtures before TASK-0045 merges (runbook
lane 3). The fixtures are a contract between three cards.

**Independent Test**: import each fixture from the shared package in a test; assert every
event validates, the engine events match what the engine produces from the recorded dice,
and each fixture's documented projection facts hold.

**Acceptance Scenarios**:

1. **Given** the fixtures package entry, **When** a client-side module imports it, **Then** it
   compiles without importing any server-plane module. (AC #4, enables TASK-0047)
2. **Given** each fixture, **When** its engine-event batches are regenerated by running the
   engine with the fixture's recorded commands and scripted dice, **Then** they equal the
   committed events. (AC #6)

---

### Edge Cases

- An `action.commented`, `action.committed` or `action.resolved` event names an action that
  was never declared: the fold ignores it, keeps it in the transcript, and counts it in
  diagnostics. It never fails.
- An action is committed twice, or commented after commit: the second commit is ignored and
  counted; a late comment is kept in the transcript and does not change the status.
- Two actions are committed while one resolves: both stay `committed` and resolve in log
  order (decision-0016 concurrency); the projection lists them in sequence order.
- A mechanics batch is only partly in the log (a crash between appends): each event folds on
  its own, because engine events carry `after` values; the batch shows fewer events than its
  declared count, and the diagnostics count it as incomplete.
- A DM-only engine event (a hidden roll) is folded for a player: the player's ledger and
  engine state never see it; the DM's do.
- A whispered talk event addressed to one user is folded for another player: it is absent
  from that player's transcript.
- The log has gaps in `seq` for a viewer (filtered events): projections never assume
  contiguous sequence numbers.
- A future event type (for example TASK-0045's `proposal.created`) appears before this
  package knows it: it is skipped and counted, never an error.

## Requirements *(mandatory)*

### Functional Requirements

**Vocabulary (AC #1, AC #3, AC #5, AC #6)**

- **FR-001**: The system MUST define a typed schema for each session event type: `talk`,
  `narration`, `action.declared`, `action.commented`, `action.committed`, `action.resolved`,
  `table-mode.changed`, `scene.changed`, `party.member.changed`, `journal.entry.added` and
  `tracker.changed`. (AC #1, AC #3, AC #5)
- **FR-002**: Every session event type MUST carry a schema version, recorded in the log's
  existing payload-version field. A catalog MUST map each `(type, version)` pair to exactly
  one schema. (AC #1)
- **FR-003**: The system MUST store each 5e engine event as a mechanics event: the log's type
  field holds the engine event's type, and the payload wraps the unchanged engine event with
  a batch identifier, its index in the batch, the batch size, and the action or proposal it
  serves. (AC #6)
- **FR-004**: The system MUST refuse to append a session event whose payload fails its schema,
  whose `(type, version)` is not in the catalog, or whose visibility breaks its type's
  visibility rule. A refusal MUST write nothing. (AC #1, AC #5)
- **FR-005**: The vocabulary MUST stay open: a new event type (for example the gate's
  proposal events, TASK-0045) MUST be addable as a catalog entry without changing any
  existing schema or projection.

**Talk versus action (AC #1, AC #2)**

- **FR-006**: A talk event MUST change only the transcript projection. (AC #2)
- **FR-007**: The action projection MUST derive each action's status from its lifecycle
  events: `declared`, then `discussed` after the first comment, then `committed`, then
  `resolved`. Out-of-order lifecycle events MUST be ignored and counted, never fatal. (AC #1)
- **FR-008**: A declared action MUST record its scope: the declaring character's own action,
  or a party-scope action (decision-0016). A comment MUST record its stance: comment,
  approve or object.
- **FR-009**: A resolved action MUST link to the mechanics batches it produced, or record the
  engine's refusal code when the engine refused it.

**Table modes (AC #3)**

- **FR-010**: A session MUST start in free mode. A `table-mode.changed` event MUST record the
  mode before and after, and turn mode MUST name the active player (actor) and, when known,
  the active character. (AC #3)

**Projections (AC #4, AC #7, AC #8)**

- **FR-011**: The system MUST fold an ordered event stream into these projections, using the
  stream alone: scene, party, encounter, journal, transcript, actions, table mode, ledger,
  and (DM viewer only) trackers. (AC #4)
- **FR-012**: Party and encounter projections MUST take every hit point, condition and
  initiative value from the engine's own fold of the mechanics events; projections MUST NOT
  recompute a rule. (AC #4)
- **FR-013**: Folding the same stream from sequence 0 MUST produce deeply equal projections
  every time, and folding it one event at a time MUST produce the same result as folding it
  at once. A database-backed test MUST prove this on a real stored log. (AC #7)
- **FR-014**: The fold MUST skip an unknown type, an unknown version of a known type, and a
  payload that fails its schema, without failing, and MUST count each skip in diagnostics.
  (AC #8)

**Hidden information (AC #5)**

- **FR-015**: The system MUST define a DM-only visibility marker. Tracker events MUST carry
  it. (AC #5)
- **FR-016**: A projection built for a player MUST exclude every event the player may not
  see, and MUST exclude tracker events whatever their marker. A test MUST prove no player
  projection contains tracker data. (AC #5)

**Ledger (AC #6)**

- **FR-017**: Every roll event MUST carry a non-empty reason, and every state-change event
  (engine or session) MUST carry before and after values. Schemas MUST enforce this, and a
  test MUST check it for every type in the catalog. (AC #6)
- **FR-018**: The ledger projection MUST list one row per roll (reason, expression, faces,
  total) and one row per state change (reason, before, after), in log order, filtered per
  viewer. (AC #6)

**Fixtures (enables TASK-0045 and TASK-0047)**

- **FR-019**: The system MUST ship committed example event streams covering talk only, a
  free-mode action lifecycle, a turn-mode combat, secret trackers, and unknown or invalid
  events. Each fixture MUST validate against the catalog, and a test MUST regenerate its
  engine events from recorded commands and scripted dice.
- **FR-020**: Schemas, projections and fixtures MUST be importable by the web client without
  importing the server plane.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM and AI companions MUST append talk and action
  events, and read projections, through the same server functions a human's requests use.
  No event type is human-only.
- **CR-003** (III. Three data planes): Every new type and projection MUST live in the session
  plane or in a pure shared package; the shared package MUST NOT import the server or web
  planes, and a boundary rule with a violating fixture MUST prove it.
- **CR-004** (VI. 5e engine boundary): This feature MUST reach mechanics only through the
  engine package (its event schemas and its fold). No projection rolls a die or computes a
  rule.
- **CR-006** (IV. Event-sourced play): The log stays append-only and unchanged; events carry
  a schema version; hidden information lives in events with a visibility marker and is
  filtered per viewer at projection time; projections tolerate unknown types.

### Key Entities

- **Session event**: one row of the log, typed by the catalog: actor, type, versioned payload,
  visibility, sequence number, timestamp.
- **Mechanics event**: a session event whose payload wraps one engine event plus its batch
  position and the action or proposal it serves.
- **Action**: a declaration that a character does something; has a scope, a declaring actor,
  comments, a commit and a resolution.
- **Table mode**: free or turn; turn mode names an active player.
- **Secret tracker**: a named clock with segments and a filled count, visible to the DM only.
- **Viewer**: who a projection is built for: the DM, or one player identified by user id.
- **Projections**: scene, party, encounter, journal, transcript, actions, table mode, ledger,
  trackers, plus diagnostics counting skipped events.
- **Fixture**: a named, committed example event stream with the viewers it is meant for.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of session event types and engine event types in the catalog validate
  their committed fixture examples, and 100% of their state-change types carry before and
  after values.
- **SC-002**: Replaying any fixture or stored log from sequence 0 gives identical projections
  in 100% of runs, compared field by field.
- **SC-003**: Across every fixture, the player-viewer projections contain zero occurrences of
  any tracker identifier, name or value.
- **SC-004**: A fold over a stream with unknown or invalid events completes in 100% of runs
  and reports the exact number of skipped events.
- **SC-005**: The play route author can render every fixture without starting a server or a
  database.

## Assumptions

- **DM-only marker.** The marker is the reserved visibility value `dm`. The M0 WebSocket
  rule (`public` or the viewer's own user id) already withholds `dm` events from every
  connection, which is the safe direction. Delivering `dm` events live to a DM's connection
  is part of TASK-0045's DM-only proposal path, which needs the same rule; this card supplies
  the shared visibility function it adopts.
- **Who is the DM viewer.** In M2 the DM viewer is the operator role or the AI DM running in
  the server. Player viewers are identified by user id.
- **Actors.** A human actor is the user id the server already records. AI actors use the
  reserved ids `ai:dm` and `ai:companion:<characterId>` (decision-0014: companions are
  actors).
- **Write paths.** This card provides validated append helpers. Routing every client and LLM
  write through them, and enforcing commit authority, is TASK-0045 (its AC #1 and AC #6).
  The WebSocket `send` path is unchanged here.
- **Batch atomicity.** The M0 log appends one event per call. Appending an engine result as
  one all-or-nothing batch is TASK-0045's job ("appends every returned event in order, or
  nothing"). This card's fold tolerates a partial batch (Edge Cases).
- **Narration.** `narration` is defined here so the transcript and fixtures have the DM's
  story output. TASK-0046 may add a version when its audit node needs more fields.
- **Out of scope, owned elsewhere:** proposal events and policies (TASK-0045); turn jobs and
  the Director (TASK-0046); the play route (TASK-0047); group sign-off (TASK-0049) and floor
  passing (TASK-0050); the WebSocket replay/live duplicate (TASK-0095, another session).

## Open Questions (operator; defaults applied)

1. **Mechanics type naming.** Default: the log's type field holds the engine event's own type
   (`hp.changed`, `dice.rolled`), and session-native types never reuse an engine type name.
   Alternative: prefix engine types (`engine.hp.changed`).
2. **Engine `v` versus payload version.** The engine contract's consumer note says the engine
   event's `v` is the payload's schema version. Default: the payload is a wrapper with its
   own version 1, and the engine's `v` travels unchanged inside it, because the batch
   position must live beside the engine event. This card updates that consumer note in
   `specs/026-dnd5e-engine/contracts/engine-api.md` in the same PR.
