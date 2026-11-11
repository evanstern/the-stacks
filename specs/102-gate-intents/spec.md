# Feature Specification: Gate accepts Intents

**Feature Branch**: `task-0268-gate-intents`
**Created**: 2026-11-11
**Status**: Draft (spec author, R1 sweep). Implementation waits on the C-GATE ruling (plan.md).
**Card**: TASK-0268 (N-03). Parent epic TASK-0258.
**Input**: TASK-0268 description and AC #1–#4; spec 092 plan "Migration" 1–4; spec 097 contract
`planner.md` (execution rule, adjudication table); spec 100 OQ-4.

**Authored against** (upstream `plan.md` commits): spec 092 `06d7ca13`, spec 097 `a34d5d39`,
spec 100 `16ae6147` (on main through merge `34e13e12`), spec 099 `58fc1fd4`, spec 101 `02b96689`.
Consumed only through published exports: `@the-stacks/intent` (contract v1.1 §11) and
`@the-stacks/planner` (contract §1–§7).

`speckit-clarify` skipped: every ambiguity is either settled by an upstream contract or listed under
"Open questions" with a recommendation.

## Summary

Add the `intent` gate request. The gate binds the authenticated seat to the Intent, checks seat,
turn, commit state and policy, builds `PlanState`, calls `plan()`, runs the planned commands through
the engine, and appends the engine rows plus one carrier row in one atomic batch. A `needs_ruling`
result opens a ruling request: a ruling turn job under the AI seat, a proposal row under a human
seat. A `ruling` or `set_dc` Intent answers it. `action.declare` keeps its rows and gains a pure
envelope to a `declared` `attempt` Intent. A `reveal` Intent with a zone target writes
`zone.revealed` through `revealRows`.

## Scope

In scope:

- `intent` request kind, carrier event `intent.recorded`, the `intents` projection, `openRulings`.
- Seat, turn, commit-state and policy checks (contract §3, §6 seats, §7).
- `PlanState` built from projections and seed-derived planner inputs; `seen` from `targetStatus`.
- The planner execution rule (contract §3, OQ-7 of spec 097).
- Ruling requests: storage, the AI ruling job, the human proposal row, answers.
- The `action.declare` envelope (spec 092 migration 2).
- Gate-handled kinds: `reveal` (zone), speech kinds that map to existing rows, `end_turn`.

Out of scope (owned elsewhere):

- Interpret emitting Intents; `resolve.ts` losing ported paths: TASK-0269.
- Companion and monster turns emitting Intents: TASK-0299.
- The quiet ring, the confirm row and `ask_dm`: TASK-0199.
- Composer pills sending `intent` requests: TASK-0247.
- Reactions and roll requests (`react`, `roll`, `request_roll`): TASK-0276.
- The DM console: TASK-0284. Per-PC and codex-block reveals: TASK-0288 (N-23).
- Fact sheet "why" rows from `PlanFact`: TASK-0272. The CI latency gate itself: TASK-0300.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A confirmed attack resolves in code (Priority: P1)

A player in turn mode, on their turn, sends `/attack @goblin-2 weapon="Longsword"` as a `confirmed`
Intent. The gate plans it, runs `attack.roll` (and its damage step on a hit) through the engine,
and appends the engine rows and one `intent.recorded` row. No model is called.

**Why this priority**: card AC #1; constitution II and IX (fact rows < 1 s).

**Independent Test**: a session-model plan test and a server integration test with a fake gateway
that fails on any call.

**Acceptance Scenarios**:

1. **Given** turn mode with Thorin active and goblin-2 engaged, **When** Thorin's player sends a
   confirmed `attack`, **Then** the batch holds the engine rows then `intent.recorded` with
   `outcome: "settled"`, its `batchId` and the planner's `facts`, and the fake gateway records no call.
2. **Given** Kestrel is active, **When** Thorin's player sends a confirmed `attack`, **Then** the gate
   refuses `NOT_YOUR_TURN` and appends nothing.
3. **Given** goblin-2 stands in a fogged zone, **When** a player targets it, **Then** the planner
   refuses `TARGET_UNSEEN` (its `seen` is false) and nothing is appended.
4. **Given** a player sends an Intent with `actor: pc:mira` they do not control, **Then** the gate
   refuses `NOT_YOUR_ACTOR`.
5. **Given** a player sends `apply_damage`, **Then** the gate refuses `DM_SEAT_REQUIRED`.

### User Story 2 — A ruling request reaches the right DM seat (Priority: P1)

A player sends a confirmed `attempt` ("I climb the rope"). The planner returns `needs_ruling`
(ask `outcome`). Under the AI seat the gate writes the carrier row and the enqueuer queues a ruling
turn job; the AI DM answers with a `ruling` Intent. Under a human seat the gate also writes a
`proposal.created` row the DM approves, rejects, or answers with a `ruling` Intent.

**Why this priority**: card AC #2.

**Acceptance Scenarios**:

1. **Given** the AI seat, **When** a confirmed `attempt` is planned, **Then** the batch holds one
   `intent.recorded` row with `outcome: "needs_ruling"` and the request, and the enqueuer queues a
   `turn` job with trigger `ruling`.
2. **Given** that job runs, **When** the fake gateway answers `{ decision: "accept" }`, **Then** the
   AI DM submits a `ruling` Intent, the gate appends its carrier row with fact `no-roll`, and the
   request closes.
3. **Given** a human seat, **When** the same `attempt` is planned, **Then** the batch also holds a
   `proposal.created` row (`policy: "ask"`, `proposal: { kind: "intent", intent }`).
4. **Given** that proposal, **When** the seated DM sends `proposal.approve`, **Then** the gate plans a
   `ruling accept` from the DM and appends `proposal.approved` in the same batch.
5. **Given** a `check` with no DC from a player (ask `difficulty`), **When** the human DM sends
   `ruling { requestId, decision: "accept", difficulty: "hard" }`, **Then** the check rolls and
   `proposal.approved` closes the proposal.
6. **Given** an `ai:dm` ruling whose `amend` body carries a literal `dc`, **Then** the gate refuses
   `MODEL_NUMBER`.

### User Story 3 — Old declare clients keep working (Priority: P1)

A client that sends `action.declare { text, scope, characterId }` sees exactly today's rows. The
gate wraps the request in a `declared` `attempt` Intent to validate it.

**Why this priority**: card AC #3.

**Acceptance Scenarios**:

1. **Given** every existing `action.declare` test and fixture, **When** they run, **Then** they pass
   unchanged and the planned rows are byte-equal to before.
2. **Given** any valid `action.declare`, **When** `declareIntent` maps it, **Then** the result parses
   with `IntentSchema`, is kind `attempt`, `commit: "declared"`, `id` equal to `actionId`, and
   `parse(toText(i))` round-trips.

### User Story 4 — The DM reveals a zone (Priority: P2)

The DM sends `/reveal #loft to=party`. The gate writes one public `zone.revealed` row through
`revealRows`. Afterwards a player's `PlanState.seen` is true for actors in that zone.

**Why this priority**: card AC #4 (spec 100 OQ-4).

**Acceptance Scenarios**:

1. **Given** the loft is fogged, **When** the DM sends a `reveal` Intent targeting `zone:loft`,
   **Then** the batch is `zone.revealed` then `intent.recorded`.
2. **Given** the loft is already revealed, **Then** only the carrier row is written.
3. **Given** a player sends `reveal`, **Then** the gate refuses `DM_SEAT_REQUIRED`.
4. **Given** snag stands in a fogged zone, **Then** `targetStatus` is `unseen` and snag's `seen` is
   false; **after** the reveal, `targetStatus` is `ok` and `seen` is true.

### Edge Cases

- A `draft` Intent is refused `DRAFT_NOT_ACCEPTED`.
- A `declared` mechanical Intent is recorded (`outcome: "declared"`) and not planned. A later
  `confirmed` Intent with the same `id` and an equal body confirms it. A different body is refused
  `INTENT_EXISTS`.
- A second Intent with a settled or open id is refused `INTENT_EXISTS`.
- Speech, meta, session and DM-control kinds treat `declared` as `confirmed` (contract §7 rules 5, 6).
- A refused first command appends nothing. A refused later command stops the run; earlier events
  stand and the carrier records `stopped` (planner contract §3 rule 4).
- An empty `commands` list writes only the carrier row (a legal no-roll outcome).
- An `action.declare` whose text trims to empty fails the envelope: `INVALID_PROPOSAL`.
- A `reveal` with `to` as a pc list, or an entity or item target, is refused `KIND_UNSERVED`
  (owner TASK-0288).
- A carrier row whose batch holds a row the fog rule made `dm` is itself `dm`.
- An `ai:dm` `intent` under a human seat routes by policy `intent` (default `ask`).

## Requirements *(mandatory)*

### Functional Requirements

**Request and carrier**

- **FR-001**: `ProposalSchema` MUST gain `{ kind: "intent", summary, rationale, intent: IntentSchema }`.
  `ProposalKindSchema` and `DmProposalKindSchema` MUST gain `intent`. `GATE_REQUEST_KINDS` grows by one.
- **FR-002**: The catalog MUST gain `intent.recorded` v1 (kind `lifecycle`, any visibility) with
  payload `IntentRecordedV1` (plan.md "Data model").
- **FR-003**: Each accepted Intent MUST append exactly one `intent.recorded` row, last in its batch.
  A refused Intent MUST append nothing.
- **FR-004**: `SessionProjections` MUST gain `intents` (per id: status, seq, intent, request,
  proposal id). The helper `openRulings(p)` MUST return the open requests by `requestId`.

**Seat, commit and turn (checked before `plan()`, in this order)**

- **FR-005**: The gate MUST refuse `commit: "draft"` with `DRAFT_NOT_ACCEPTED`.
- **FR-006**: The gate MUST refuse a kind whose `KIND_RULES` seats exclude the principal's seat:
  `DM_SEAT_REQUIRED` when the seats are DM-only, else `NOT_AUTHORIZED`.
- **FR-007**: The gate MUST check `actor` against the principal (contract §3 table) and refuse a
  mismatch `NOT_YOUR_ACTOR`. A player maps to `pc` ids they control; an AI companion to its own
  `companion` id; a human DM to `dm`, any `npc`, and a `pc` it controls; `ai:dm` to `ai:dm` and any
  `npc`. A DM seat confirming a recorded `declared` Intent skips this check.
- **FR-008**: The gate MUST refuse `INTENT_EXISTS` for an id already recorded, except the confirm of
  FR-009.
- **FR-009**: A `declared` Intent of a planned kind MUST be recorded and not planned. A `confirmed`
  Intent with a `declared` id and an equal body (all fields but `commit` and `source`) MUST be planned.
- **FR-010**: In turn mode with an encounter, a player or companion Intent whose kind mutates
  (`KIND_RULES.mutates` `yes` or `via-ruling`, group not `reaction` or `roll`) MUST be refused
  `NOT_YOUR_TURN` unless its actor's combatant is active and the DM does not hold the floor.
  DM seats are exempt.
- **FR-011**: `ai:dm` Intents MUST route by the effective policy of kind `intent`
  (`DEFAULT_POLICIES.intent = "ask"`; the AI seat is always `auto`). Every other proposer routes direct.
- **FR-012**: An `ai:dm` `ruling` whose `amend` body carries `dc`, or an `amount` of kind `fixed`,
  MUST be refused `MODEL_NUMBER` (OQ-10).

**Planning and execution**

- **FR-013**: The gate MUST build `PlanState` from the DM projection and the server's planner inputs
  (casters, SRD spell ids, inits, table rules). Party members key by character id with side
  `party`; NPCs key by their seed id; engine sides map to `side`, a missing side to `neutral`;
  `presence` comes from `scenePresence`; `openRequests` from `openRulings`.
- **FR-014**: Each `PlanActor.seen` MUST equal `targetStatus(p, viewer, { kind: "actor", id }) === "ok"`
  for the proposer's viewer. The planner's `space` MUST be `spatialFor(p, viewer)` (spec 100 OQ-4).
  A DM seat's viewer is `{ role: "dm" }`.
- **FR-015**: The gate MUST run planned commands per planner contract §3: in order, evolving state;
  skip a command whose `when` does not hold (`stepOutcome`); a refused first command refuses the
  Intent (source `engine`); a refused later command stops the run and keeps earlier events.
- **FR-016**: Planner refusals MUST surface with `source: "gate"` and the `IntentRefusalCode`;
  engine refusals with `source: "engine"`. `details` passes through.
- **FR-017**: Engine rows MUST be mechanics envelopes (`actionId: null`, `proposalId` as today) and
  pass the fog rule (`fogRows`) before validation, as every planned row does today.
- **FR-018**: The gate MUST NOT call `plan()` for a "not-planned" kind. It MUST handle them:
  `say`, `say_to`, `emote` → `talk` (`ic`, the actor's character id); `ooc`, `party` → `talk`
  (`ooc`); `npc_say` → `talk` (`ic`, `characterId: null`); `narrate` → `narration`; `reveal` → FR-019.
  Every other not-planned kind MUST be refused `KIND_UNSERVED` with `details.owner` (OQ-8).
- **FR-019**: A `reveal` with one `zone` target and `to: "party"` MUST plan `revealRows(p, actor,
  [zoneId], reason)`. An unknown zone or no space MUST be refused `TARGET_NOT_PRESENT`.
- **FR-020**: `end_turn` MUST plan through the floor `end` rules (turn advance, settling, the
  `table-mode.changed` row) for the current turn, not through `plan()` (OQ-6).

**Ruling requests**

- **FR-021**: A `needs_ruling` result MUST append the carrier row with `outcome: "needs_ruling"`,
  the request and the facts. Under a human seat the batch MUST also hold `proposal.created`
  (`policy: "ask"`, `proposal: { kind: "intent", intent }`, actor the Intent's proposer).
- **FR-022**: Under the AI seat, the DM enqueuer MUST queue a `turn` job with trigger `ruling` for a
  `needs_ruling` carrier row.
- **FR-023**: Every AI-seat turn job MUST first answer each open ruling request, oldest first, with one
  structured model call and one `ruling` Intent from `ai:dm` through `gate.submit` (OQ-2, OQ-3).
- **FR-024**: A `ruling` or `set_dc` Intent that settles MUST close its request. When the request has
  an open proposal, the batch MUST also hold `proposal.approved` (accept, amend, `set_dc`) or
  `proposal.rejected` (reject).
- **FR-025**: `proposal.approve` on a ruling proposal MUST plan `ruling { decision: "accept" }` from
  the seated DM. On ask `difficulty` it MUST be refused `PROPOSAL_NOT_APPROVABLE`.
  `proposal.reject` MUST plan `ruling { decision: "reject", reason }`.

**Declare envelope**

- **FR-026**: `declareIntent(action, proposer, p)` MUST map `action.declare` to `{ id: actionId, kind:
  "attempt", actor, params: { scope }, text, source, commit: "declared" }`. `actor` is `pc:<characterId>`
  (or `companion:<id>` for an AI companion); a party scope with a null character uses the first party
  member the proposer controls. `source` is `composer` for a human, `ai` for a companion.
- **FR-027**: The `action.declare` path MUST validate `declareIntent` with `IntentSchema` and
  otherwise plan exactly today's rows and refusal codes.

**Delivery**

- **FR-028**: The WebSocket send path MUST map `NOT_YOUR_ACTOR`, `DM_SEAT_REQUIRED` and `NOT_YOUR_TURN`
  to error kind `forbidden`. No frame shape changes.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The AI DM, AI companions and humans send the same `intent` request
  through the same gate. The AI DM answers rulings with the same `ruling` Intent a human sends.
- **CR-002** (II. One Intent vocabulary): The gate calls the planner for every planned kind. A
  confirmed attack reaches the engine with no model call (AC #1).
- **CR-003** (III. Server authority): A refusal appends nothing. Model output reaches the log only as
  a `ruling` Intent. Fogged rows stay `dm`.
- **CR-004** (V. Many views): `intents` is a fold of `intent.recorded`; player views get only rows
  they may see.
- **CR-005** (VI. Engine owns numbers): `MODEL_NUMBER` holds at schema and for `amend` bodies (FR-012).
- **CR-006** (VII, IX "why"): Every carrier row stores the planner's `PlanFact[]` for TASK-0272.
- **CR-007** (IX. UX): The gate adds no I/O beyond today's projection load. TASK-0300 measures
  `gate.handle` entry to the `onAppended` call.
- **CR-008** (XIII. Plan just-in-time): Every unserved kind names an owner card or an open question.

### Key Entities

- **IntentRecorded**: the carrier row: the Intent, its outcome (`declared`, `settled`,
  `needs_ruling`), batch id, facts, request, the answered request id, and a `stopped` refusal.
- **IntentView**: the per-id projection entry; **openRulings**: open requests with their proposal id.
- **PlannerInputs**: seed-derived planner state the server supplies per call.

## Success Criteria *(mandatory)*

- **SC-001**: A confirmed player `attack` appends engine rows and a carrier row with zero model calls,
  in a session-model test and a DB integration test (AC #1).
- **SC-002**: A `needs_ruling` result queues a `ruling` turn job under the AI seat and writes a
  `proposal.created` row under a human seat; both answer paths close the request (AC #2).
- **SC-003**: Every existing `action.declare` test passes unchanged, and every `action.declare`
  fixture maps to a schema-valid, round-tripping `attempt` Intent (AC #3).
- **SC-004**: A zone `reveal` Intent writes `zone.revealed`; `seen` follows `targetStatus` before and
  after it (AC #4).
- **SC-005**: Each gate refusal code in FR-005–FR-012 and FR-018–FR-019 has a test, and each served
  kind group the gate touches has a gate test per outcome (`settled`, `needs_ruling`, refusal).
- **SC-006**: `pnpm ci:check` is green and the wiki freshness gate prints `OK`.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 Confirmed `attack` from a player appends engine events, no model call | FR-013–FR-017, SC-001; phases 2–3 |
| #2 `needs_ruling` → ruling job (AI seat) or proposal row (human seat) | FR-021–FR-025, SC-002; phases 3–4 |
| #3 `action.declare` clients keep working through the envelope | FR-026–FR-027, SC-003; phase 1 |
| #4 Zone reveal through the gate; targetStatus `ok` → `seen` | FR-014, FR-019, SC-004; phase 2 |
| Description: seat, turn, policy; DM-control Intents need the DM seat | FR-005–FR-011; phase 2 |

## Assumptions

- TASK-0266, 0267, 0270, 0271 and 0274 are merged (they are, on `fb396882`).
- Planner contract §3 execution rule and §5 adjudication table are binding as written.
- The seed supplies casters, NPC inits and table rules; a session with no scene uses empty inputs
  and table rules `{ outcomeBands: true, naturals: true }`.

## Open questions

Each has a recommendation. The orchestrator rules or cards each one.

- **OQ-1 — session-model imports the planner.** Target-architecture §8 draws Planner → Server only.
  Spec 097 OQ-1 already planned this edge (no cycle: the planner cannot import session-model).
  **Recommend:** adopt. `planProposal` stays the one pure planner the approve path reuses. The wiki
  phase records the edge; amend the §8 diagram on the next replan edit.
- **OQ-2 — The AI ruling call's purpose.** A new `dm.ruling` purpose needs a hosted `AI_PURPOSES`
  entry (a vm-104 change, C9). **Recommend:** call purpose `dm.adjudicate` with a new prompt
  `dm.ruling-v1`; `PURPOSE_OF` gains no caller (the ruling node uses `PURPOSE_OF.adjudicate`).
- **OQ-3 — Ruling job shape.** A new job kind needs migration 0010 (`jobs_kind_valid`,
  `dm_model_calls_job_kind_valid`) and a claim-query edit. **Recommend:** a `turn` job with trigger
  `ruling`, and every AI-seat turn answers open requests first (FR-023). The one-queued-turn index
  then coalesces safely. No migration.
- **OQ-4 — Narration after a settled Intent.** This card queues no narrate run; fact rows render from
  the log. **Recommend:** add an AC to TASK-0269: "a settled Intent batch from the live path is
  narrated from the fact sheet".
- **OQ-5 — `hostilesStanding` on legacy Director moves.** The planner applies it to `end_combat`
  Intents only. The Director's `mechanics encounter.end` and `table-mode` proposals stay as today.
  **Recommend:** after merge, close TASK-0147 as absorbed and trim TASK-0145 to #2–#4 (spec 097
  OQ-6), and add a note to TASK-0269 that #1 reaches the Director when its moves become Intents.
- **OQ-6 — `end_turn` bypasses `plan()`.** The planner plans only `turn.advance`; the table needs the
  settle loop and the `table-mode.changed` row the floor rules write. **Recommend:** plan `end_turn`
  through the shared floor `end` code (FR-020). The planner's `end_turn` stays for tests and TASK-0299.
- **OQ-7 — Withdrawing a declared Intent.** Contract §7 has `declared → withdrawn`. This card only
  records and confirms. **Recommend:** add an AC to TASK-0199 (it owns the declared lifecycle).
- **OQ-8 — Unserved not-planned kinds.** `whisper`, `pause`, `bookmark`, `recap`, `retry_narration`
  have no owner card; `ask_dm` belongs to TASK-0199. **Recommend:** `ask_dm` → owner `TASK-0199`;
  card "whisper Intents" in lane LT after TASK-0247; card "session Intents (pause, bookmark, recap,
  retry_narration)" as an R2 revisit with trigger "the DM console or notebook needs them".
- **OQ-9 — One policy for all `ai:dm` Intents.** **Recommend:** adopt `intent: "ask"`. Card a per-kind
  policy only when a human-DM table asks for it.
- **OQ-10 — Numbers inside an `amend` body.** Contract §6.12 lists only top-level `dc` and amounts.
  **Recommend:** the gate refuses them in an `ai:dm` amend body (FR-012) and the orchestrator reports
  it at C-CON as a clarification, as on 2026-11-08.
- **OQ-11 — A human DM answering a difficulty ask in R1.** The approve button cannot carry a tier,
  and the console (TASK-0284) is R3. **Recommend:** if the R1 scenario seats a human DM, card "the
  approvals slide-out answers a difficulty ask" in lane LT before CP-7; otherwise a revisit card with
  trigger "a human-DM table plays a check Intent".
- **OQ-12 — Carrier visibility.** **Recommend:** `public`, or `dm` when the fog rule made any row of
  the batch `dm`, so a hidden actor's Intent never leaks.
- **OQ-13 — TASK-0300 latency seam.** **Recommend:** no new hook. The test times `gate.handle` entry
  to the `onAppended` listener call that carries the `intent.recorded` row. It costs nothing.
- **OQ-14 — Contract kind counts.** Code has 19 request kinds; contract 029 already reads 21 after the
  TASK-0188 amendment (`action.suggest`, `action.accept`, built by TASK-0199). **Recommend:** the code
  moves 19 → 20; the contract text reads 22 once TASK-0199 lands. State both in the amendment.
