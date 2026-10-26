# Feature Specification: First Scene — proposal gate (autonomy policies and commit authority)

**Feature Branch**: `task-0045-proposal-gate`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0045 ("First Scene: proposal gate — autonomy policies and commit
authority"), M2 First Scene sweep, lane 3. Grounding: architecture A4, A10, A11, A12;
decision-0014, decision-0015, decision-0016, decision-0017, decision-0020, decision-0021;
constitution 2.0.0 (principles I, III, IV, VI); the engine contracts in
`specs/026-dnd5e-engine/contracts/`; the session-model contracts in
`specs/028-session-model/contracts/`; the TASK-0044 hand-off note on the card (adopt `canSee`
in `apps/server/src/ws/registry.ts`).

**Clarify pass**: skipped. Every open point has a default that an existing artifact settles:
the policies and their effects come from decision-0015 and A10; commit authority comes from
decision-0016's table; the one-human reduction comes from decision-0016's consequences and
decision-0014; refuse-before-write comes from decision-0021 idea 1 and the engine's refusal
contract. The defaults chosen are listed under Assumptions; the choices the operator may want
to revisit are listed under Open Questions.

## Context

The session log (M0) is the only source of truth, and TASK-0044 gave it a typed vocabulary
and projections. Nothing yet stands between intent and the log: the WebSocket `send` frame
appends any type a client names, including mechanics and secret-tracker types, and the AI DM
(TASK-0046) has no sanctioned way to write.

This feature adds **the gate**: the one mechanism that turns intent into log rows.

- Every LLM output and every player action is a **typed proposal** (a Zod schema per kind).
- A **per-kind policy table** (`auto`, `ask`, `suggest`) decides what happens to a proposal
  from the AI DM. The table is the autonomy dial (decision-0015).
- **Commit authority** by table mode decides who may commit an action (decision-0016).
- The gate **refuses before write**: an illegal proposal returns a specific code (the
  engine's own code for a mechanics refusal) and nothing is appended.
- **Pending proposals are events** with DM-only visibility, so they survive restarts and
  reach only the DM.
- The WebSocket gateway delivers DM-only events to **the seated DM's** live connection, using
  the session model's `canSee` rule.

The "users" are five kinds of caller: the AI DM runtime (TASK-0046) submits proposals; AI
companions submit actions; a human player declares, comments and commits; a human DM
approves, rejects and issues direct commands; the play route (TASK-0047) renders pending
proposals and commit controls from the same rules.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The AI DM runs the game through the gate (Priority: P1)

An AI DM is seated. The DM runtime proposes a check roll for the lock Ana is picking. The gate
applies it at once through the engine: the roll and its outcome land in the log as one
atomic batch, and every connected client sees them. Then the runtime proposes narration and
a journal entry, which also apply at once.

**Why this priority**: goal 3 (the AI runs the game) is the M2 demo. Without the gate the
DM runtime has no sanctioned write path.

**Independent Test**: seat no human DM (the default). Submit a `mechanics` proposal from
`ai:dm` with scripted dice. Assert the engine's events land in one batch with consecutive
`seq`, no `proposal.*` event is written, and the result reports `applied`.

**Acceptance Scenarios**:

1. **Given** an AI DM seat and a legal `mechanics` proposal, **When** the AI DM submits it,
   **Then** the engine's events are appended as one atomic batch and the result is
   `applied`.
2. **Given** an AI DM seat, **When** the AI DM submits a proposal of any kind, **Then** the
   effective policy is `auto` whatever the table says, because no human DM can be asked.
3. **Given** a `mechanics` proposal the engine refuses (for example a dead target), **When**
   it is submitted, **Then** the result is a refusal carrying the engine's code
   (`TARGET_DEAD`) and the log is unchanged.

---

### User Story 2 - A human DM approves or rejects the AI's proposals (Priority: P1)

The operator takes the DM seat. The AI DM runtime still drafts the game, but under the
default table it asks first: a proposed roll appears in the DM's approval panel and nowhere
else. The DM approves it and the roll lands. The DM rejects a narration draft. A scene
change arrives as a suggestion the DM can read and dismiss but not approve; the DM issues
their own scene command instead.

**Why this priority**: goal 4 (the AI assists a human DM) and decision-0015's `ask` and
`suggest` effects. It is the second end of the autonomy dial.

**Independent Test**: seat a human DM. Submit an `ask` proposal from `ai:dm`. Assert one
`proposal.created` event with `dm` visibility and nothing else. Approve it as the DM. Assert
the engine's events and a `proposal.approved` event land in one atomic batch.

**Acceptance Scenarios**:

1. **Given** a human DM seat and a kind whose policy is `ask`, **When** the AI DM submits a
   legal proposal, **Then** exactly one `proposal.created` event is appended with `dm`
   visibility, and nothing is applied.
2. **Given** a pending `ask` proposal, **When** the seated DM approves it, **Then** the
   proposal's effects and a `proposal.approved` event land in one atomic batch.
3. **Given** a pending `ask` proposal, **When** the seated DM rejects it, **Then** a
   `proposal.rejected` event is appended and nothing is applied.
4. **Given** a kind whose policy is `suggest`, **When** the AI DM submits a proposal, **Then**
   one `proposal.created` event with policy `suggest` is appended, nothing is applied, and an
   approval of it is refused.
5. **Given** a pending proposal that has become illegal (its target died meanwhile), **When**
   the DM approves it, **Then** the approval returns the engine's code, nothing is appended,
   and the proposal stays pending.
6. **Given** a player's connection, **When** a `proposal.created` event is appended, **Then**
   the player's connection never receives it, live or on replay.

---

### User Story 3 - A human DM's own command uses the same engine path (Priority: P1)

The seated human DM types a damage command for a goblin. The gate treats it as an already
approved proposal: it runs through the same planning and engine call as an approved AI
proposal, and no `proposal.*` event is written.

**Why this priority**: decision-0015 ("A human DM's own commands go through the same engine,
already approved") and constitution IV (every change through the gate and the engine).

**Independent Test**: with the same state and the same scripted dice, apply one `mechanics`
proposal as a human DM's direct command and the same proposal as an approved AI proposal.
Assert the two sets of engine events are deeply equal.

**Acceptance Scenarios**:

1. **Given** a human DM seat, **When** the DM submits any DM kind, **Then** it applies at
   once, with no `proposal.created` event, through the same planner the approval path uses.
2. **Given** a player who is not the seated DM, **When** the player submits a `mechanics`
   proposal, **Then** the gate refuses with `NOT_AUTHORIZED` and writes nothing.

---

### User Story 4 - Commit authority follows the table mode (Priority: P1)

In exploration (free mode) Ana's player declares and commits her own action. Bram's
companion cannot commit Ana's action. When combat starts (turn mode), only the active
player may commit, for their turn. A party-scope action ("we take the left tunnel") is
committed by the one human player, or by the DM. The DM may always commit or override.

**Why this priority**: decision-0016's commit-authority table is the trigger for every DM
turn. Getting it wrong lets the wrong actor start a turn.

**Independent Test**: for every row of decision-0016's table, submit an `action.commit` from
the actor the row allows and from one it forbids. Assert the allowed commit lands with the
row's `authority` and the forbidden one is refused with `COMMIT_NOT_ALLOWED`.

**Acceptance Scenarios**:

1. **Given** free mode and a character-scope action, **When** its declarer (who controls the
   character) commits it, **Then** `action.committed` lands with authority `declarer`.
2. **Given** free mode, **When** any other non-DM actor commits it, **Then** the gate refuses
   with `COMMIT_NOT_ALLOWED`.
3. **Given** turn mode, **When** the active actor commits an action for the character it
   controls, **Then** it lands with authority `active-player`; anyone else is refused.
4. **Given** a party-scope action and exactly one human player in the party, **When** that
   player commits it, **Then** it lands with authority `group`.
5. **Given** a party-scope action and more than one human player in the party, **When** a
   player commits it, **Then** the gate refuses with `GROUP_SIGNOFF_REQUIRED` (group
   sign-off is TASK-0049).
6. **Given** any mode, **When** the DM (the seated human DM, or the AI DM through its
   policy) commits an open action, **Then** it lands with authority `dm`.

---

### User Story 5 - Pending proposals survive a restart (Priority: P1)

The human DM has two proposals waiting when the server restarts. After the restart the DM
reconnects, and both proposals are still pending: the approval panel shows them on replay,
and approving one applies it.

**Why this priority**: AC #9 and the runbook's merge condition for this task. Pending
proposals are events precisely so they need no second store.

**Independent Test**: on a real database, submit two `ask` proposals. Close the server and
its database pool. Start a fresh server with a fresh pool. Connect as the seated DM, replay
from 0, and assert both `proposal.created` events arrive and the DM projection lists both as
pending. Approve one and assert it applies.

**Acceptance Scenarios**:

1. **Given** pending proposals and a server restart, **When** the DM's connection replays
   the session, **Then** every pending proposal arrives and projects as pending.
2. **Given** the restarted server, **When** the DM approves a proposal created before the
   restart, **Then** it applies exactly as it would have before.

---

### User Story 6 - Only typed proposals carry LLM output to the log (Priority: P1)

A reviewer wants proof that no code path lets model output reach the log except as a typed
proposal. A test walks the server's import graph and fails when any module outside the gate
and the session seam can write to the log, or when the gate can reach the model gateway.

**Why this priority**: AC #1 and constitution IV ("LLM output MUST reach the log only as a
typed proposal").

**Independent Test**: run the write-boundary test. Then add a module under the AI tree that
imports a log writer (in the test's violation fixture tree) and assert the test reports it.

**Acceptance Scenarios**:

1. **Given** the server source tree, **When** the write-boundary test runs, **Then** it finds
   every log-writing import inside the allow-list and no path from the gate to the model
   gateway.
2. **Given** the violation fixture tree, **When** the checker runs over it, **Then** it
   reports each seeded violation.

---

### User Story 7 - The play route renders proposals and commit controls (Priority: P2)

TASK-0047 builds the DM approval panel and the commit control against fixtures before this
task merges. It needs fixture streams with pending, approved, rejected and suggested
proposals, and a pure function that says who may commit an action, so the UI shows the
control only to whoever holds commit authority.

**Why this priority**: the play route is a parallel lane; a stable fixture and a pure rule
let it proceed without the server.

**Independent Test**: fold the `dm-approvals` fixture for the DM and for a player. Assert the
DM sees the listed proposals in the listed states and the player sees none of them.

**Acceptance Scenarios**:

1. **Given** the `dm-approvals` fixture, **When** it is folded for the DM viewer, **Then**
   `proposals` holds the fixture's listed proposals with the listed statuses.
2. **Given** the same fixture folded for any player viewer, **Then** `proposals` is `[]` and
   the serialized projections contain no proposal id or proposal body.
3. **Given** the `commit-authority` fixture, **When** `commitAuthority` is evaluated for each
   listed actor and action, **Then** it returns the listed authority or refusal code.

### Edge Cases

- **Two approvals race** for one proposal. Exactly one applies; the other is refused with
  `PROPOSAL_NOT_PENDING`. The gate appends with an expected last sequence number and retries
  on conflict, so a decision is never made against a stale log.
- **A write lands between the gate's read and its append** (for example a turn job and a
  player both writing). The append fails its expected-sequence check, writes nothing, and the
  gate re-reads, re-plans and retries; after three conflicts it refuses with `CONFLICT`.
- **A proposal becomes illegal while pending.** Approval returns the current refusal code
  and writes nothing; the proposal stays pending until the DM rejects it.
- **The seat changes while proposals are pending.** Pending proposals stay in the log. A new
  human DM sees them on replay and may decide them. Under an AI seat nobody can approve them;
  they are inert until a human DM rejects them.
- **The AI DM proposes `action.commit` under a human seat.** It follows the `action.commit`
  policy (default `ask`); when approved it lands with authority `dm`.
- **A client sends a catalogued event type through the raw `send` frame** (for example
  `dice.rolled`). The gateway refuses it as `forbidden` and writes nothing.
- **A client sends an uncatalogued type** (the M0 `chat` frame). The gateway appends it
  through the inert legacy path; every projection skips it as an unknown type.
- **A suggested proposal is approved.** Refused with `PROPOSAL_NOT_APPROVABLE`; the DM may
  reject it to dismiss it.
- **A proposal names an action that does not exist or is closed.** Refused with
  `UNKNOWN_ACTION` or `ACTION_NOT_OPEN`.
- **The unknown-and-invalid fixture's future-proposal row** would now decode as an invalid
  `proposal.created`. The row is retyped to an uncatalogued type so the fixture's counters do
  not change.

## Requirements *(mandatory)*

### Functional Requirements

**Proposals (AC #1, AC #2)**

- **FR-001**: The system MUST define a closed set of twelve proposal kinds, each with a Zod
  schema: `talk`, `action.declare`, `action.comment`, `action.commit`, `action.resolve`,
  `mechanics`, `narration`, `table-mode`, `scene`, `party`, `tracker`, `journal`.
- **FR-002**: The gate MUST parse every submission with the proposal schema before any other
  step; a parse failure MUST refuse with `INVALID_PROPOSAL` and write nothing.
- **FR-003**: The gate MUST be the only server module that writes catalogued session events.
  The WebSocket gateway MUST route every gate request kind to the gate and MUST refuse a raw
  `send` of any catalogued type.
- **FR-004**: A test MUST walk the server's static import graph and fail when a module
  outside the allow-list imports a log-writing function, or when the gate or the session seam
  can reach the AI gateway module (AC #1).

**Policies (AC #2–#5)**

- **FR-005**: A policy table MUST map each of the eleven kinds the AI DM may propose to
  `auto`, `ask` or `suggest`, with the defaults in contracts/policy-and-authority.md.
- **FR-006**: The seated human DM (or the operator) MUST be able to change one row of the
  table through a `gate.policy` request, recorded as a `gate.policy.changed` event.
- **FR-007**: With an AI DM seated, the effective policy for every kind MUST be `auto`.
- **FR-008**: Policy `auto` MUST plan the proposal through the engine and append its rows
  at once (AC #3).
- **FR-009**: Policy `ask` MUST check the proposal's legality, append exactly one
  `proposal.created` event with `dm` visibility, and apply nothing until a
  `proposal.approve` request from the seated DM (AC #4).
- **FR-010**: Approval MUST re-plan the proposal against the current log, and append its rows
  and the `proposal.approved` event in one atomic batch.
- **FR-011**: Policy `suggest` MUST check the proposal's legality, append one
  `proposal.created` event with policy `suggest` and `dm` visibility, and apply nothing;
  approving it MUST refuse with `PROPOSAL_NOT_APPROVABLE` (AC #5).
- **FR-012**: The seated DM MUST be able to reject a pending `ask` or open `suggest`
  proposal, recorded as `proposal.rejected`.

**Authority (AC #6, AC #7)**

- **FR-013**: The gate MUST enforce which proposer may submit which kind (the permission
  matrix in contracts/proposals.md); a violation MUST refuse with `NOT_AUTHORIZED`.
- **FR-014**: The gate MUST enforce decision-0016's commit authority by table mode, scope and
  controller, and MUST record the derived authority on `action.committed` (AC #6).
- **FR-015**: With one human player in the party, a party-scope action MUST be committable by
  that player (authority `group`) or by the DM; with more than one, a player's commit MUST
  refuse with `GROUP_SIGNOFF_REQUIRED` (TASK-0049 adds group sign-off).
- **FR-016**: The DM (the seated human DM, or `ai:dm` subject to its policy) MUST be able to
  commit any open action with authority `dm`.
- **FR-017**: A seated human DM's submission of any DM kind MUST apply at once through the
  same planner function an approved proposal uses, and MUST write no `proposal.*` event
  (AC #7).
- **FR-018**: The DM seat MUST be session state in the log (`dm.seat.changed`), defaulting to
  the AI DM; only an operator-role user MAY change it.
- **FR-019**: Commit authority, the permission matrix and the effective policy MUST be pure
  functions of the session projections, importable by the web client.

**Refusals (AC #8)**

- **FR-020**: For a `mechanics` proposal the engine refuses, the gate MUST return the engine's
  refusal code unchanged and write nothing.
- **FR-021**: Every gate refusal MUST carry a source (`gate`, `engine` or `append`) and a code
  from a closed list, and MUST leave the log unchanged.
- **FR-022**: The gate MUST plan every proposal (including the legality check for `ask` and
  `suggest`) before its first write.

**Persistence and delivery (AC #4, AC #9)**

- **FR-023**: Proposal lifecycle events (`proposal.created`, `proposal.approved`,
  `proposal.rejected`) MUST be catalogued session events that only accept `dm` visibility.
- **FR-024**: The projections MUST gain a `proposals` view (DM viewer only), the DM seat and
  the policy overrides; a player viewer's `proposals` MUST be `[]`.
- **FR-025**: The WebSocket registry and replay MUST filter every event with the session
  model's `canSee`, treating a connection as the DM viewer exactly when its user holds the
  session's human DM seat.
- **FR-026**: The gate MUST hold no in-memory proposal state; a test MUST restart the server
  (fresh server, fresh pool) and show pending proposals intact and approvable (AC #9).
- **FR-027**: Every event the gate appends MUST be broadcast to the session's subscribers,
  whoever submitted it (a human over WebSocket or the DM runtime in-process).

**Fixtures (TASK-0047 contract)**

- **FR-028**: The session-model fixtures MUST gain `dm-approvals` and `commit-authority`
  streams and one valid example proposal per kind, with the facts in contracts/fixtures.md.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM and AI companions MUST write through the same gate
  entry points a human's requests use. Every human gate request has an agent equivalent; the
  only human-only requests are the DM's approve and reject and the operator's seat change,
  which exist to supervise agents.
- **CR-003** (III. Three data planes): The gate MUST live in the session plane
  (`apps/server/src/gate/`) and its pure rules in `packages/session-model`; neither may
  import the library or codex planes.
- **CR-004** (VI. 5e engine boundary): The gate MUST reach mechanics only through the
  engine's `execute`, with a seeded or injected RNG, and MUST NOT compute a rule itself.
- **CR-006** (IV. Event-sourced play): Every change MUST pass through the gate and the engine
  before it appends; a refusal appends nothing; LLM output reaches the log only as a typed
  proposal; pending proposals are hidden information in `dm`-visibility events.

### Key Entities

- **Proposal**: a typed request to change the session (one of twelve kinds), from a
  proposer, with an optional summary and rationale for the DM.
- **Proposer**: a human user (with role and seat) or an AI actor (`ai:dm`,
  `ai:companion:<characterId>`).
- **Policy table**: a map from each AI-DM proposal kind to `auto`, `ask` or `suggest`;
  defaults plus per-session overrides in the log.
- **DM seat**: who is the session's DM — the AI DM or one human user.
- **Proposal record** (projection): a created proposal's id, kind, policy, proposer, body and
  status (`pending`, `approved`, `rejected`).
- **Gate result**: `applied`, `pending`, `suggested`, or a refusal with source and code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of decision-0016's commit-authority rows have an allowed and a forbidden
  case in the test suite, and each passes.
- **SC-002**: For every policy (`auto`, `ask`, `suggest`) and both seat kinds, a test shows
  the exact events appended (and none for refusals).
- **SC-003**: Every one of the engine's 26 refusal codes that a `mechanics` proposal can
  trigger passes through the gate unchanged; a sample of at least five distinct codes is
  tested end to end with zero rows written.
- **SC-004**: After a server restart, 100% of pending proposals are listed for the DM and
  approvable; 0 reach a player connection.
- **SC-005**: The write-boundary test reports 0 violations on the real tree and every seeded
  violation in its fixture tree.
- **SC-006**: Every committed action in every existing fixture re-derives its recorded
  authority through `commitAuthority`.

## Assumptions

- The M2 table seats one human plus AI companions (decision-0014). Group sign-off, floor
  passing and presence are M3 (TASK-0049 to TASK-0052).
- The policy table governs proposals from the AI DM only. Players and AI companions are
  actors; their actions follow commit authority, which decision-0016 calls their "sign-off
  policy".
- The default DM seat is the AI DM, matching the M2 demo where the operator plays the human
  seat. A human DM seat is taken explicitly.
- The gate folds the session log for every request. M2 sessions are short; the fold is the
  same `project` function the replay tests already exercise.
- The engine RNG for live play is seeded per call from the platform's cryptographic random
  source; tests inject scripted dice. The faces, not the seed, are the audit record.
- The WebSocket frame shapes do not change, apart from the optional `code` field named in Open
  Question 1.
- No new runtime dependency and no migration: proposals are events in the existing log.

## Open Questions (operator; defaults applied)

1. **Error frame `code` field.** The ws-protocol contract makes a frame-shape change an
   operator checkpoint. Default: add an optional `code` string to the `error` frame (additive;
   old clients ignore it) so the play route can show the refusal code. Alternative: keep the
   shape and prefix the code onto `message`.
2. **The inert legacy `send` path.** Uncatalogued types (`chat`, the load bench's ping) still
   append raw, because the M0 play route and bench use them. Default: keep the path in this
   task, refuse every catalogued type, and have the orchestrator card "Retire the uncatalogued
   WebSocket send path" ordered after TASK-0047 (decision-0020: card before merge).
3. **The DM seat.** Default: the seat is a logged session fact (`dm.seat.changed`), the AI DM
   by default, changeable only by the operator. Alternative: treat every operator-role
   connection as the DM — rejected by default because the operator plays the human seat in
   the M2 demo and would receive secret trackers.
4. **Default policy values** for a human DM seat (contracts/policy-and-authority.md): `ask`
   for mechanics, narration, table mode, party, trackers, DM talk, DM comments and DM commits;
   `suggest` for scene changes; `auto` for action resolution and journal entries.
5. **More than one human in a party-scope commit.** Default: refuse with
   `GROUP_SIGNOFF_REQUIRED` until TASK-0049 defines the quorum.
