# Feature Specification: First Scene — play route: composer, commit control, ledger, DM approvals

**Feature Branch**: `task-0047-play-route`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0047 ("First Scene: play route — composer, commit control, ledger,
DM approvals"), M2 First Scene sweep, lane 3. Grounding: architecture A12 and A13;
decision-0008, decision-0013, decision-0015, decision-0016, decision-0020; doc-0003
(frontend rulings); constitution 2.0.0; the chat-ui design decision
(`docs/design/chat-ui/decision.md`); the TASK-0044 session-model contracts in
`specs/028-session-model/contracts/`.

**Clarify pass**: skipped. Every open point has a default that an existing artifact settles.
The surfaces come from the card and decision-0016; commit authority comes from
decision-0016's table; the visual language and the no-modals rule come from the chat-ui
decision; client-only rendering comes from decision-0008 and doc-0003 ruling 1. The proposal
types are not yet visible (TASK-0045 is specified in parallel), so this spec defines the
pending-proposal surface by what the DM needs to see and decide, and the plan defines the
seam. The defaults are listed under Assumptions; the choices the operator may revisit are
listed under Open Questions.

## Context

TASK-0044 gave the session log a play vocabulary: talk, the action lifecycle (declared,
discussed, committed, resolved), table modes, the scene, the party, the journal, the roll
ledger, and per-viewer projections. It also committed five fixture event streams as the
shared contract for the play route and the gate.

This feature is the human surface over that vocabulary: the in-app table view's first slice
(decision-0013; maps arrive in M6). A player and a DM use it at the table:

- **One composer** sends talk or declares an action. The player chooses which.
- **A declared action** shows its comments and, for whoever holds commit authority, a
  commit control.
- **A table-mode indicator** shows free or turn mode, and in turn mode the active player.
- **A ledger panel** lists every roll with its reason and every state change with its before
  and after values.
- **A DM approval panel** lists pending proposals; the DM approves or rejects each one.

The route renders two sources through the same components: a committed fixture stream and a
live session log. Fixtures exist now; the live proposal path arrives with TASK-0045. The
route therefore builds and tests against fixtures first, and its final phase wires the live
proposal path after TASK-0045 merges.

The users are three: the human player, the human DM (the operator role in M2), and the
operator previewing fixtures. An agent drives the same table through the same session
protocol the route uses (constitution I).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Talk or declare an action from one composer (Priority: P1)

A player at the table types a line. Before sending, the player chooses whether it is talk
(in character or out of character) or an action their character takes. Talk appears in the
transcript and changes nothing. A declared action appears as an action card with its
declarer, its text and its status.

**Why this priority**: talk versus action is the core play contract (decision-0016). Without
the composer, nothing else on the route has input.

**Independent Test**: open a fixture table as a player, send one talk line and declare one
action, and confirm the transcript shows a talk line and a new action card in status
"declared".

**Acceptance Scenarios**:

1. **Given** a player on the table route with the composer in Talk, **When** the player sends
   "Anyone hear that?", **Then** the transcript shows the line as talk from that player, and
   no action card is created.
2. **Given** the composer in Action with the player's character selected, **When** the player
   sends "Ana picks the lock", **Then** an action card appears with Ana as the character, the
   text, and status "declared".
3. **Given** the composer, **When** the player switches between Talk and Action, **Then** the
   current choice is always visible and announced to assistive technology, and the draft text
   is kept.
4. **Given** a viewer who controls no character (the DM, or a player with no party member),
   **When** the viewer opens the composer, **Then** Action is unavailable and a short hint
   says why; Talk still works.
5. **Given** an empty or whitespace-only draft, **When** the user tries to send, **Then**
   nothing is sent.

---

### User Story 2 - Discuss and commit a declared action (Priority: P1)

Anyone at the table comments on a declared action, approves it or objects to it. The person
who holds commit authority sees a commit control on the card and commits the action. Everyone
else sees who may commit it. A committed action is locked; a resolved action shows its
outcome.

**Why this priority**: commit is the explicit step that gives players agency and the DM
pipeline its trigger (decision-0016). AC #2.

**Independent Test**: open the free-mode fixture stepped to just after Ana's declaration, view
as the declaring player, comment, and commit; confirm the card shows the comment, then status
"committed". View the same point as the other player; confirm no commit control is shown.

**Acceptance Scenarios**:

1. **Given** a declared action, **When** any viewer adds a comment, an approval or an
   objection, **Then** the card lists it with its author and stance, and the status becomes
   "discussed".
2. **Given** free mode and a character-scope action, **When** the declaring player views the
   card, **Then** the commit control is shown; **When** another player views it, **Then** the
   control is absent and the card names the declaring player as the one who commits.
3. **Given** turn mode, **When** the active player views their own declared action, **Then**
   the commit control is shown; **When** any other player views it, **Then** it is absent.
4. **Given** any mode, **When** the DM views any open action, **Then** the commit control is
   shown (the DM may always commit or override).
5. **Given** a party-scope action and one human player (M2), **When** that player views it,
   **Then** the commit control is shown as group sign-off.
6. **Given** a committed or resolved action, **When** anyone views it, **Then** no commit
   control and no comment input are shown; a resolved action shows applied, refused (with the
   refusal code) or no effect.

---

### User Story 3 - See the table mode and whose turn it is (Priority: P1)

Everyone at the table sees whether play is in free mode or turn mode. In turn mode they see
whose turn it is, and the active player sees that it is their turn.

**Why this priority**: commit authority depends on the mode; a player must see why they can or
cannot commit. AC #3.

**Independent Test**: step the turn-mode fixture across its three mode changes and confirm
the indicator reads free, then turn with Ana active, then turn with Bram active, then free.

**Acceptance Scenarios**:

1. **Given** free mode, **When** anyone views the route, **Then** the indicator reads
   "Free mode".
2. **Given** turn mode with an active player, **When** anyone views the route, **Then** the
   indicator names the active character (or actor when no character is named), and the active
   player's own view marks it as their turn.
3. **Given** a mode change arrives, **When** it is folded, **Then** the indicator updates
   without a reload.

---

### User Story 4 - Read the ledger (Priority: P2)

Any viewer opens the ledger panel and sees every roll, with its reason, dice, faces and total,
and every state change, with its reason and its before and after values. A player never sees a
DM-only row; the DM sees every row.

**Why this priority**: the ledger is how a table trusts that the engine, not a model, made
every number (constitution VI, decision-0021 idea 2). AC #4.

**Independent Test**: open the free-mode and turn-mode fixtures, open the ledger, and confirm
the lock-pick roll with reason "Ana picks the vault lock" and the goblin's hit points before
and after the hit; open the secret-tracker fixture as a player and confirm the hidden roll is
absent, then as the DM and confirm it is present.

**Acceptance Scenarios**:

1. **Given** a session with rolls, **When** the viewer opens the ledger panel, **Then** each
   roll shows its reason, expression, each die face, the total and the natural roll.
2. **Given** a session with state changes, **When** the viewer opens the ledger panel,
   **Then** each change shows its reason, what changed, and the before and after values of
   every field that differs; a creation shows "none" before and a removal shows "none" after.
3. **Given** a player viewer and DM-only rows, **When** the player opens the ledger, **Then**
   no DM-only row appears.
4. **Given** the ledger panel is open, **When** a new roll is folded, **Then** it appears in
   the list without closing the panel.

---

### User Story 5 - Approve or reject pending proposals as the DM (Priority: P2)

The DM opens the approval panel and sees each pending proposal: what it would do, who proposed
it, and the action it serves. The DM approves or rejects each one. Approved and rejected
proposals leave the pending list. Players never see the panel or its contents.

**Why this priority**: policy `ask` (decision-0015) needs a human surface; without it an `ask`
proposal waits forever. AC #5.

**Independent Test**: open a fixture table as the DM, open the approval panel, approve one
proposal and reject another, and confirm both leave the list and the pending count drops.
Open the same table as a player and confirm there is no approval control.

**Acceptance Scenarios**:

1. **Given** the DM and two pending proposals, **When** the DM opens the approval panel,
   **Then** both are listed with a summary, the proposer, the proposal kind and their details.
2. **Given** a pending proposal, **When** the DM approves it, **Then** it leaves the pending
   list.
3. **Given** a pending proposal, **When** the DM rejects it (with an optional reason typed
   inline), **Then** it leaves the pending list.
4. **Given** pending proposals exist, **When** the DM views the route with the panel closed,
   **Then** the approval control shows the pending count.
5. **Given** a player viewer, **When** the player views the route, **Then** no approval
   control and no proposal content is rendered.

---

### User Story 6 - Preview the table from fixtures (Priority: P2)

The operator opens a fixture table, chooses which viewer to see it as (the DM or one of the
fixture's players), and steps through the stream event by event. The fixture table renders
through exactly the same components as a live table.

**Why this priority**: fixtures let the route be built, tested and reviewed before the gate
and the DM runtime exist, and they are the evidence for AC #7.

**Independent Test**: open each of the five fixtures as each of their viewers and confirm the
route renders without error; step the free-mode fixture forward and back.

**Acceptance Scenarios**:

1. **Given** the operator, **When** they open the fixture list, **Then** all five committed
   fixtures are listed with their descriptions.
2. **Given** a fixture table, **When** the operator switches viewer, **Then** the route
   re-renders as that viewer, including hidden rows for the DM only.
3. **Given** a fixture table, **When** the operator steps to an earlier or later event,
   **Then** the route shows the table as of that event.
4. **Given** a fixture table, **When** the operator uses the composer, commit control or
   approval panel, **Then** the change applies to that page's local copy of the fixture only
   and is gone on reload.
5. **Given** a signed-in player, **When** they open a fixture URL, **Then** they see the
   "available to the operator only" message.

---

### User Story 7 - Play on a live session log (Priority: P1)

A player and the DM open the same live table. Everything above works on the live log: the
composer writes to the session, actions and comments arrive for both, and the ledger and mode
indicator follow the log. After TASK-0045 merges, the DM's approval panel lists the live
pending proposals and the DM's decisions reach the gate.

**Why this priority**: the live table is the deliverable; fixtures are its proof harness.
AC #7.

**Independent Test**: on the worktree stack, open one live table in two Brave windows (player
and DM), send talk, declare and commit an action, and confirm both windows show the same
transcript and card state. After TASK-0045 merges, raise an `ask` proposal and approve it from
the DM's window.

**Acceptance Scenarios**:

1. **Given** two viewers on one live table, **When** one sends talk or declares an action,
   **Then** both see it after the server records it, and neither sees it before.
2. **Given** a live table with a history, **When** a viewer reloads, **Then** the route
   rebuilds the same view from the log.
3. **Given** the connection drops, **When** it returns, **Then** the route resumes without
   duplicate or missing entries, and a status shows connecting or reconnecting meanwhile.
4. **Given** TASK-0045 has merged and a proposal waits for approval, **When** the DM approves
   or rejects it, **Then** the decision reaches the gate and the proposal leaves every DM's
   pending list.

---

### Edge Cases

- **Unknown, newer or invalid events** (for example the M0 `chat` rows of an old table) are
  skipped by the fold. The route shows a quiet notice with the count of entries not shown, and
  never fails.
- **An action whose lifecycle event breaks the status rules** keeps its last valid status; the
  fold ignores the event.
- **Seq gaps** for a filtered viewer are normal; the route never treats a gap as missing data.
- **A commit sent by a viewer without authority** (a stale view, or a crafted frame) is the
  server's to refuse; the route never shows the action as committed until the commit event
  arrives.
- **A refusal or error frame** from the server leaves the connection open and shows a short
  inline notice near the composer.
- **The approval panel is open when the last proposal is decided**: the panel stays open and
  shows "No pending proposals".
- **A long ledger** (hundreds of rows) stays scrollable inside its panel, newest last.
- **A narrow screen** (700 px or less): panels open as bottom sheets, the composer stays at
  the bottom, and nothing scrolls sideways.
- **A fixture URL that names no fixture** shows "No such fixture" with a link to the list.
- **The live DM before TASK-0045 merges** receives no DM-only events (the M0 delivery rule),
  so the approval panel shows "No pending proposals".

## Requirements *(mandatory)*

### Functional Requirements

**Composer (AC #1)**

- **FR-001**: The route MUST offer exactly one composer, with a visible choice between Talk and
  Action.
- **FR-002**: In Talk, the user MUST be able to choose in character or out of character; a sent
  talk line MUST record that choice and, in character, the viewer's character.
- **FR-003**: In Action, the user MUST choose the character (from the characters the viewer
  controls; preselected when there is one) and the scope (this character, or the whole party).
- **FR-004**: The composer MUST NOT render a sent line before the server (or, for a fixture, the
  local copy) records it.
- **FR-005**: The composer MUST keep the draft when the user switches between Talk and Action,
  and MUST clear it once the line is accepted for sending.

**Actions and commit (AC #2)**

- **FR-006**: Each declared action MUST render as one card showing its character, declarer,
  text, scope, status, every comment with its author and stance, and, once resolved, its
  outcome and refusal code.
- **FR-007**: Any viewer MUST be able to add a comment, an approval or an objection to an open
  (declared or discussed) action.
- **FR-008**: The commit control MUST be shown to a viewer exactly when decision-0016's table
  grants that viewer commit authority over that action in the current table mode:
  the DM for any open action; in turn mode, the active player for their own action; in free
  mode, the declaring player for their own character's action; for a party-scope action, the
  human players' group sign-off, which in M2 is the one human player (decision-0016
  consequences).
- **FR-009**: A viewer without commit authority MUST see who may commit the action instead of
  the control.
- **FR-010**: Committing MUST record the authority under which the viewer commits.

**Table mode (AC #3)**

- **FR-011**: The route MUST always show the current table mode.
- **FR-012**: In turn mode the route MUST name the active character or actor, and MUST mark it
  as the viewer's own turn when it is.

**Ledger (AC #4)**

- **FR-013**: A ledger panel MUST list every roll visible to the viewer, each with its reason,
  expression, die faces, total and natural roll.
- **FR-014**: The ledger panel MUST list every state change visible to the viewer, each with its
  reason, its subject, and the before and after values of each changed field.
- **FR-015**: The ledger panel MUST also list each resolved outcome (attack, check, rest) with
  its reason, so a roll's consequence sits beside it.
- **FR-016**: The ledger MUST be in log order and MUST update while open.

**DM approvals (AC #5)**

- **FR-017**: For a DM viewer, the route MUST offer an approval control that shows the count of
  pending proposals and opens an approval panel.
- **FR-018**: The approval panel MUST list each pending proposal with a one-line summary, its
  kind, its proposer, the action it serves (when any) and its detail rows.
- **FR-019**: The DM MUST be able to approve or reject each pending proposal individually;
  rejection MUST accept an optional reason typed inline.
- **FR-020**: A decided proposal MUST leave the pending list once the decision is recorded.
- **FR-021**: A player viewer MUST receive no approval control and no proposal content.

**Surfaces (AC #6)**

- **FR-022**: Every secondary surface (ledger, approvals) MUST open as the project's slide-out
  panel; choices MUST use inline controls or an autocomplete dropdown. The route MUST NOT use a
  `<dialog>` element, `showModal`, or a centred overlay with a backdrop.
- **FR-023**: Every panel trigger MUST look openable and set its expanded state and the panel it
  controls (chat-ui decision, modification 2).

**Same components (AC #7)**

- **FR-024**: The fixture table and the live table MUST render through one shared table view and
  its components; the two differ only in the source of events, the viewer, and where commands
  go.
- **FR-025**: Given the same events and viewer, the fixture source and the live source MUST
  produce identical rendered output.
- **FR-026**: The operator MUST be able to open any committed fixture as any of its viewers and
  step through it by event.
- **FR-027**: In fixture mode, commands MUST apply only to the page's local copy of the fixture.

**Client-only (AC #8)**

- **FR-028**: Both the live and the fixture table routes MUST render only in the browser; the
  server MUST send only a loading fallback for them (decision-0008, doc-0003 ruling 1).

**Connection and resilience**

- **FR-029**: The live table MUST show its connection status and MUST resume after a drop with no
  duplicate or missing entries.
- **FR-030**: The route MUST tolerate unknown, newer and invalid events, and MUST show a count of
  entries not shown when it is above zero.
- **FR-031**: The route MUST show a refused request as an inline notice and keep the connection.

**Proposal wiring (gated on TASK-0045)**

- **FR-032**: After TASK-0045 merges, the live approval panel MUST list the pending proposals the
  gate records, and approve and reject MUST reach the gate through its interface.
- **FR-033**: After TASK-0045 merges, live composer writes and commits MUST reach the server
  through whatever write path TASK-0045 makes binding for player actions.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): Every route action (talk, declare, comment, commit, approve,
  reject) MUST be a frame on the documented session protocol (or, after TASK-0045, the gate's
  documented interface), so an agent drives the table through the same interface the route
  uses. No action exists only in the UI.
- **CR-002** (III. Data planes): The route MUST read only the session plane, and MUST NOT show
  library content (chat-ui decision: library content never appears on the Table).
- **CR-003** (IV. Event sourcing): The route MUST derive every view from the session log through
  the shared projections, filtered per viewer; it MUST NOT hold play state the log does not
  hold, and it MUST NOT render anything before the server records it.
- **CR-004** (VI. 5e engine boundary): The route MUST display engine results only; it MUST NOT
  roll dice or compute any game number.
- **CR-005** (VIII. Operator-owned content): The route MUST ship no proprietary rulebook
  content; fixture content stays original or SRD-named.

### Key Entities

- **Table source**: what feeds the shared table view — the viewer, the events visible to them,
  the connection status, the pending proposals, and the commands the view may issue.
- **Table view model**: what the components render — scene, table mode and active player,
  transcript, action cards with commit authority, ledger rows, pending proposals, and counts of
  entries not shown.
- **Pending proposal (view)**: a proposal awaiting the DM — id, kind, summary, proposer, the
  action it serves, detail rows, when it was raised.
- **Commit authority**: for one viewer and one action, whether the viewer may commit it and under
  which authority (declarer, active player, group, DM).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five committed fixtures render as every one of their listed viewers with zero
  errors.
- **SC-002**: For each fixture and viewer, the fixture source and the live source render
  identical output from the same events (100% of pairs).
- **SC-003**: The commit control appears for exactly the viewers decision-0016 grants, in every
  row of its table (each row covered by a test).
- **SC-004**: In the secret-tracker fixture, a player's rendered route contains none of the
  hidden roll, tracker or DM journal content (zero leaks).
- **SC-005**: A player can send talk and declare and commit an action in under 30 seconds on a
  fresh table.
- **SC-006**: Zero `<dialog>` elements, `showModal` calls or centred backdrop overlays exist in
  the web app.
- **SC-007**: The server-rendered HTML for both table routes contains only the loading fallback.
- **SC-008**: Brave screenshots of the route from fixtures and from a live log, in light and dark,
  are attached to the PR, and all text in them meets WCAG AA contrast.

## Assumptions

- **Who is the DM viewer.** In M2 the operator role is the DM viewer and a player is a player
  viewer by user id (specs/028-session-model, Assumptions). A single signed-in operator does not
  also play a character on the live route.
- **Commit authority shown, not enforced.** The route shows the commit control by
  decision-0016's table. Enforcement is the gate's (TASK-0045 AC #6). After TASK-0045 merges,
  the route adopts the gate's own rule if TASK-0045 exports one to the client.
- **Group sign-off.** With one human (M2), group sign-off is that player's commit (decision-0016
  consequences). Multi-player group sign-off is TASK-0049; floor passing is TASK-0050.
- **Live writes before TASK-0045.** Until TASK-0045 merges, the live composer writes through the
  existing session protocol's `send` frame, which records events without authority checks. The
  draft PR is held until TASK-0045 merges (runbook), so this state never reaches `main`.
- **Live proposals before TASK-0045.** No proposal event type exists yet, and DM-only events
  reach no live connection. The live approval panel is therefore empty until the gated phase.
  Fixture mode uses a small set of web-local example proposals in the pending-proposal view
  shape; the gated phase derives them from TASK-0045's events where TASK-0045 provides
  fixtures.
- **Presence and narrator chime-in** are not shown; they are TASK-0051 and TASK-0052 (M3).
- **Maps and tokens** are M6 (decision-0013).
- **Fixture route in all builds.** The fixture table is operator-only and ships in every build,
  so the operator and TASK-0048 can preview the table on any stack. Fixture data loads only
  when that route opens.

## Open Questions

1. **Fixture route in production builds.** Default: ship it, operator-only, loaded on demand.
   Alternative: development builds only (then fixture screenshots need the dev server).
2. **Component render tests need a TSX-capable runner.** Default: add `vitest` (already in the
   lockfile, used by five workspace packages) as a dev dependency of `apps/web`, with no DOM
   library. Alternative: test only the pure view-model modules and rely on Brave evidence for
   markup.

## Acceptance-criteria map

| Card AC | Requirements | Stories | Success criteria |
|---|---|---|---|
| #1 One composer, talk or action | FR-001–FR-005 | US1 | SC-005 |
| #2 Comments and commit control for the authority holder | FR-006–FR-010 | US2 | SC-003 |
| #3 Table mode and active player | FR-011, FR-012 | US3 | SC-001 |
| #4 Ledger: rolls with reasons, changes with before/after | FR-013–FR-016 | US4 | SC-004 |
| #5 DM approval panel | FR-017–FR-021, FR-032 | US5, US7 | SC-001 |
| #6 Slide-out panels and autocomplete only | FR-022, FR-023 | all | SC-006 |
| #7 Fixtures and live log through the same components | FR-024–FR-027, FR-029–FR-031, FR-033 | US6, US7 | SC-001, SC-002, SC-008 |
| #8 Client-only (decision-0008) | FR-028 | all | SC-007 |
