# Feature Specification: Scene presence as tracked actor state, with a producer

**Feature Branch**: `task-0141-scene-presence`
**Spec dir**: `specs/048-scene-presence`
**Created**: 2026-10-27
**Status**: Draft — STOPPED for operator rulings OQ-1 to OQ-4 (one-way doors). No plan.md yet.
**Board card**: TASK-0141 (Track C6, runbook amendment 1; carries the two absent checks moved
from TASK-0112 by the 2026-10-27 operator ruling, sequencing Option A)
**Input**: TASK-0141, decision-0025 (D17) card U2, `docs/design/actor-state-gate.md` §5,
spec 046 "Sequencing: the absent halves".

## Governing decision

This card implements decision-0025 (D17, "Actor-state rule gate", TASK-0135) card **U2, scene
presence and its producer**, plus the absent halves of card **U6**. It implements these rules:

- **Terms, "Scene presence".** An actor's place in the scene is `present`, `yielded` or
  `absent`. `yielded` is present and no longer opposing. `absent` is gone from the scene. Scene
  presence is not decision-0024's (D16) player connection presence.
- **Terms, "Plot" and "Recorded fact"; rule §2.1.** A scene presence change is plot. It moves
  only through a recorded fact: a gate-written row. Prose never changes scene presence.
- **§1.2.** Every snapshot actor carries scene presence. This card makes the value real: it is
  read from the log, not defaulted.
- **§3.1, declare half (absent).** The declare gate refuses a character that is `absent`.
- **§3.2, plan half (absent).** Every step's actor and target must not be `absent` in S0.
- **§2.5, producer half only.** The Director may not end an encounter by flight on prose. A
  presence producer must exist first (design §3.2, Formulation 2 note). This card builds the
  producer. It gives the Director no presence field.

It implements none of these, each owned by a card:

- §2.2 enforcement, "a change to another actor needs a roll against that actor": the resolve
  batch gate, TASK-0147 (U9). This card's prompt grammar places another actor's presence change
  under a roll's outcome. It does not refuse an unrolled one.
- §2.5 Director legality over `yielded` and `absent`: TASK-0145 (U5).
- §3.4 claim gate on prose naming an absent actor: TASK-0143 (U3).
- Seed NPC initial presence per beat, and seed NPC presence changes: TASK-0142 (U8, the C3
  "M3, minimal" ruling). This card's event is keyed by snapshot actor id, so U8 reuses it.
- The audit prompt reading S1 presence: TASK-0146 (U7).

**Builds on**:

- TASK-0140 (spec 040, merged). `SnapshotActor.presence` exists and is always `present`
  (contract rule 7). The diff already emits `presence` changes. The `fiction` view already
  renders `yielded` and `absent`, and the cap compresses absent actors.
- TASK-0110 (spec 045, merged). Resolve runs rulings, action groups, the NPC group, then the
  Director closing moves, then the turn advance.
- TASK-0112 (spec 046, PR #71, **not merged**). It adds the gate code `CHARACTER_UNABLE` with an
  open `details.reason` set (`CHARACTER_UNABLE_REASONS`), the engine code `ACTOR_UNABLE`, the
  pure plan gate `apps/server/src/dm/gates/plan-gate.ts` (`checkPlan`, verdict code
  `UNKNOWN_COMBATANT`, reasons `not-a-combatant` and `not-in-snapshot`) and turn settling
  (`apps/server/src/dm/nodes/settle.ts`). This spec builds on those interfaces. The first
  implementation phase merges `origin/main` after PR #71 lands.

**Clarify**: skipped. The card, decision-0025 and spec 046 settle the behaviour. Four choices are
one-way doors: a new catalogued event, a new step grammar, an engine command change and a
refusal code. They are raised below as operator rulings OQ-1 to OQ-4, each with a recommended
default. This spec is written against the defaults. A different ruling changes the FRs marked
"(OQ-n)".

## Root cause (from the evidence)

Decision-0025 G2: "Presence is not state, so plot moves by prose."

| Evidence | What it shows |
|---|---|
| M2 demo seq 296–301 | On a no-roll dare, the narration has the goblins flee. The Director ends the encounter on that prose. No row records the flight. |
| F52 (M2 seq 307) | The playtest auditor and `dm.audit` disagree on who is present, because nothing tracks it. |
| TASK-0110 run 183818Z seq 260–265 | A bargain ends the encounter before any roll. |
| `packages/dnd5e-engine/src/commands/combatants.ts` `handleCombatantRemove` | The only existing producer, `combatant.remove`, refuses a combatant in the active encounter (`COMBATANT_IN_ENCOUNTER`). It also deletes the combatant's state. A fled goblin cannot leave the order, and a returning one would come back with new HP. |
| `apps/server/src/dm/snapshot/build.ts` | Every actor is built with `presence: "present"`. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A presence change is a logged fact (Priority: P1)

The DM's resolve node records that an actor fled, left, arrived, was removed, surrendered or
conceded. The gate writes one catalogued row with the actor id, the value before, the new value
and the reason. Every viewer's projection folds it. A replay from seq 0 gives the same presence
for every actor.

**Why this priority**: Card AC #1. Every other story reads this row.

**Independent Test**: session-model unit tests over the catalog, the fold and the planner, with
hand-built streams. No database.

**Acceptance Scenarios**:

1. **Given** a stream with a `scene-presence.changed` row for `goblin-1` (`present` to `absent`,
   reason `fled`), **When** it folds, **Then** the scene presence projection holds `goblin-1`
   as `absent` with reason `fled` and the row's seq.
2. **Given** no row for an actor, **When** the stream folds, **Then** that actor has no entry and
   readers treat it as `present`.
3. **Given** a `scene-presence` proposal whose reason does not match the new value (for example
   `fled` with `yielded`), **When** the planner runs, **Then** it refuses before any row is
   written.
4. **Given** a proposal whose new value equals the current value, **When** the planner runs,
   **Then** it refuses and the log is unchanged.
5. **Given** a player viewer, **When** the stream folds, **Then** the row is visible: it is
   public, like `scene.changed`.

---

### User Story 2 - Interpret and adjudicate propose a presence change (Priority: P1)

A player dares the goblin to fight. Interpret reads an Intimidation check against the goblin,
and on success the goblin flees. Resolve rolls the check through the engine. Only on success
does it submit the presence change. On failure the goblin stays. A party member who walks out of
the scene is the acting actor; that change needs no roll (decision-0025 §2.3).

**Why this priority**: Card AC #2. It is the only producer, and it ties presence to dice.

**Independent Test**: Schema and grammar unit tests, plus resolve node tests with the fake
gateway and scripted dice.

**Acceptance Scenarios**:

1. **Given** an interpret reading with a check step whose `onSuccess` holds a presence effect on
   `goblin-1` with reason `fled`, **When** the scripted check succeeds, **Then** resolve submits
   one `scene-presence` proposal and `goblin-1` is `absent` in S1.
2. **Given** the same reading, **When** the scripted check fails, **Then** no presence row lands
   and `goblin-1` is `present` in S1.
3. **Given** an adjudicate ruling with an effect step holding a presence effect, **When** resolve
   runs, **Then** the change lands the same way.
4. **Given** a presence effect naming an id that is no S0 actor, **When** the plan gate runs,
   **Then** the action group is refused and no step lands (TASK-0112 behaviour, unchanged).
5. **Given** the interpret and adjudicate prompts, **When** they render, **Then** the step
   grammar lists the presence effect and the closed reason list, and states that a presence
   change to another actor belongs under the outcome of a roll against that actor.
6. **Given** resolve, **When** it applies a presence effect, **Then** the write goes through
   `gate.submit` as `ai:dm`. No code path writes the row any other way.

---

### User Story 3 - An absent combatant leaves the encounter order (Priority: P1)

The goblin flees mid-fight. In the same atomic batch as the presence row, the engine takes it
out of the initiative order. Its turn never comes up again. Its HP and conditions stay in engine
state, so the snapshot still shows it, compressed, as gone. If it arrives back during the fight,
it rejoins the order with an initiative roll.

**Why this priority**: Card AC #3. Without it a fled goblin still gets NPC turns.

**Independent Test**: Engine unit tests with `scriptedRng`, planner unit tests, and resolve node
tests with the fake gateway over a turn-mode fixture.

**Acceptance Scenarios**:

1. **Given** turn mode with `goblin-1` in the order and not active, **When** its presence becomes
   `absent`, **Then** one batch lands the presence row and an engine `encounter.changed` row.
   The order no longer holds `goblin-1`, and the active combatant is unchanged.
2. **Given** `goblin-1` is the active combatant and flees on its own NPC turn, **When** the batch
   lands, **Then** the turn passes to the next combatant once. No combatant is skipped and none
   acts twice.
3. **Given** the order would be left with no entry, **When** the leave runs, **Then** the engine
   refuses and the presence row does not land (refuse before write).
4. **Given** an absent combatant with an active encounter, **When** its presence becomes
   `present` with reason `arrived`, **Then** the same batch rejoins it through `initiative.join`
   and the roll is in the ledger.
5. **Given** free mode or no active encounter, **When** a combatant's presence changes, **Then**
   only the presence row lands.
6. **Given** `yielded`, **When** it lands, **Then** the combatant stays in the order. Director
   legality over `yielded` is TASK-0145.

---

### User Story 4 - The snapshot reads scene presence from the log (Priority: P1)

Every DM prompt that renders actor state shows the logged presence. S0 shows what assemble read.
S1 shows what resolve wrote. The diff reports each change.

**Why this priority**: Card AC #4. Narrate, audit, the Director and the later gates all read the
snapshot.

**Independent Test**: Snapshot build and diff unit tests over fixture projections.

**Acceptance Scenarios**:

1. **Given** projections where `goblin-1` is `absent`, **When** `buildSnapshot` runs, **Then**
   the `goblin-1` actor has `presence: "absent"`.
2. **Given** a party member with a presence entry keyed by its character id, **When** the build
   runs, **Then** the party actor carries it.
3. **Given** S0 with `goblin-1` present and S1 with it absent, **When** `diffSnapshots` runs,
   **Then** it returns one `presence` change, `present` to `absent`.
4. **Given** a snapshot over the `fiction` cap, **When** it renders, **Then** the absent actor is
   compressed to one line and not dropped (spec 040 behaviour, now reachable).
5. **Given** a presence row that names an id no actor holds, **When** the build runs, **Then**
   the entry is ignored. No actor is invented.

---

### User Story 5 - The Director cannot write scene presence (Priority: P2)

The Director decides scene-level moves. It has no field that changes presence. A Director output
that tries to carry one does not reach the log.

**Why this priority**: Card AC #5 and decision-0025 §2.1. It stops the M2 seq 296–301 path:
prose flight followed by a Director encounter end.

**Independent Test**: A schema test over `DirectorOutput`, and a resolve test that inspects every
Director-group submission.

**Acceptance Scenarios**:

1. **Given** `DirectorOutput`, **When** a test lists its keys recursively, **Then** no key names
   presence, and parsing an output with an added presence key strips or refuses it.
2. **Given** any director decision in the resolve tests, **When** resolve runs its Director
   groups, **Then** no submission has kind `scene-presence`.
3. **Given** the import graph, **When** the boundary test runs, **Then** only the action-group
   effect path in `nodes/resolve.ts` builds a `scene-presence` proposal.

---

### User Story 6 - The declare gate refuses an absent character (Priority: P1)

A player, a companion or the scripted seat declares for a character that has left the scene.
The gate refuses before any row is written and before any model runs.

**Why this priority**: Card AC #6 (decision-0025 §3.1; moved from TASK-0112).

**Independent Test**: Planner unit tests in `packages/session-model`, plus one server gate test
through `gate.handle`.

**Acceptance Scenarios**:

1. **Given** a party character whose scene presence is `absent`, **When** its controller submits
   a character-scope `action.declare`, **Then** the gate refuses with source `gate`,
   `CHARACTER_UNABLE`, and `details` `{ characterId, reason: "absent" }`. The log is unchanged.
2. **Given** a party-scope declaration where every character the proposer controls is absent or
   not conscious, **When** it is submitted, **Then** the gate refuses with `CHARACTER_UNABLE`.
   `reason` is `absent` when any controlled character is absent, else `life-state`.
3. **Given** a `yielded` character, **When** it declares, **Then** the gate accepts it.
4. **Given** an absent character that arrives back (`present`), **When** it declares, **Then**
   the gate accepts it.
5. **Given** the check order, **When** an unauthorised proposer declares for an absent
   character, **Then** the refusal is still `NOT_AUTHORIZED`.

---

### User Story 7 - The plan gate refuses a step naming an absent actor (Priority: P1)

Interpret returns an attack on the goblin that fled last turn. Before resolve writes anything,
the plan gate refuses the whole action group. The action resolves `refused`. The job result
names the step, the field, the id and the reason `absent`.

**Why this priority**: Card AC #7 (decision-0025 §3.2; moved from TASK-0112).

**Independent Test**: Pure plan-gate unit tests over S0 fixtures, plus a resolve node test with
the fake gateway.

**Acceptance Scenarios**:

1. **Given** S0 with `goblin-1` absent, **When** a step names `goblin-1` as `targetId`,
   `attackerId`, a check's `combatantId` or an effect `targetId`, **Then** the group is refused
   with failure `{ stepIndex, field, id, reason: "absent" }`.
2. **Given** that refusal, **When** resolve records it, **Then** `action.resolved` has status
   `refused` and refusal code `UNKNOWN_COMBATANT` (OQ-4), and no step of the group lands.
3. **Given** a presence effect with reason `arrived` on an absent actor, **When** the plan gate
   runs, **Then** it passes. Arrival is the one step that may name an absent actor.
4. **Given** a `yielded` target, **When** the plan gate runs, **Then** it passes.
5. **Given** a refused NPC group, **When** resolve runs, **Then** the NPC turn has no effect and
   the turn still advances (TASK-0112 FR-020, unchanged).

---

### Edge Cases

- **A yielded actor resumes opposition.** The card's reason list has no reason for `yielded` to
  `present`. This card cannot express it. OQ-5 names it for a card.
- **An actor goes absent on its own turn** (the goblin bolts on its NPC turn). Its turn ends, and
  the next combatant acts once (User Story 3, scenario 2). The turn-advance group must not
  advance a second time.
- **The last hostile flees.** The order keeps the party, so it is not empty. The encounter does
  not end by itself. Director legality (TASK-0145) may end it from the snapshot.
- **A party member goes absent in turn mode.** It leaves the order the same way. TASK-0112
  settling never lands on it, because it is not in the order.
- **A presence effect and a damage effect on the same target in one group.** Effects run in
  order. A damage effect after the target went absent is refused by the plan gate only when S0
  already had it absent. Within one group, order is the model's; the engine accepts damage on an
  out-of-order combatant. This matches decision-0025 §3.2, which checks S0.
- **Reclaim.** A reclaimed turn must not write a presence row twice. The existing submission
  checkpoint (`stepRef`) covers it, and the planner's same-value refusal is the backstop.
- **Legacy logs** have no presence rows. Every actor reads `present`, as in U1.
- **A seed NPC with no combatant.** This card does not seed its initial presence (TASK-0142). A
  presence effect may still name it by its S0 actor id; the row lands and the snapshot reads it.

## Requirements *(mandatory)*

### Functional Requirements

**The event (AC #1) (OQ-1)**

- **FR-001**: The session model MUST catalogue `scene-presence.changed` v1, kind `state-change`,
  visibility `any`, current. Its payload is
  `{ actorId, before, after, reason, actionId }`. `before` and `after` are `present`, `yielded`
  or `absent`. `reason` is one of `arrived`, `left`, `fled`, `removed`, `surrendered`,
  `conceded`. `actionId` is the resolving action, or null for the NPC group.
- **FR-002**: The reason fixes the new value: `arrived` gives `present`; `left`, `fled` and
  `removed` give `absent`; `surrendered` and `conceded` give `yielded`. The schema MUST refuse a
  payload where `after` does not match `reason`, or where `before` equals `after`.
- **FR-003**: The projections MUST gain a scene presence view: per actor id, the presence, the
  reason and the seq. A row whose `before` differs from the folded value counts as a `before`
  mismatch diagnostic and still applies, as other state-change rows do.
- **FR-004**: The gate MUST gain one DM proposal kind, `scene-presence`, carrying
  `{ actorId, reason, actionId }`. The gate fills `before` from the projection and `after` from
  the reason. Its default policy is `ask`, like `mechanics` and `tracker`. The AI seat makes it
  `auto`, as for every kind. Only the DM (AI or seated human) may propose it.
- **FR-005**: The planner MUST refuse a `scene-presence` proposal with `INVALID_PROPOSAL` when
  the value would not change, and with `UNKNOWN_ACTION` when `actionId` names no action.
- **FR-006**: The play route's DM approvals panel MUST render the new kind with its existing
  field-list renderer (`apps/web/app/play/proposals.ts`): actor, reason, new value. No modal.
- **FR-007**: The frozen-contract edits ruled at OQ-1 MUST land in this card's PR:
  `specs/029-proposal-gate/contracts/proposals.md` (14 kinds, 12 DM kinds),
  `policy-and-authority.md` (the policy row), `gate-api.md` §1 (the rows table), and
  `specs/028-session-model/contracts/session-events.md` (the new event).

**The step grammar (AC #2) (OQ-2)**

- **FR-008**: `EffectSchema` MUST gain a variant `{ effect: "presence", targetId, reason }`.
  It may appear wherever an effect may: an `effect` step, a check's `onSuccess` and
  `onFailure`, and an attack's `onHit`. It carries no `after`; code derives it (FR-002).
- **FR-009**: `targetId` on a presence effect MUST be an S0 actor `id`. Code resolves it to the
  actor by exact id. It never maps an alias (`dm-failure-and-gates`).
- **FR-010**: `prompts/step-grammar.ts` MUST render the presence effect and the reason list. The
  interpret and adjudicate prompts MUST state that a presence change to another actor belongs
  under the outcome of a roll against that actor (decision-0025 §2.2), and that the acting
  actor's own change needs none (§2.3). The prompt versions MUST bump.
- **FR-011**: Resolve MUST apply a presence effect by submitting one `scene-presence` proposal
  through `gate.submit` as `ai:dm`, in the group's effect order. A refused proposal becomes a
  recorded result, as for every other effect.
- **FR-012**: The plan gate (`checkPlan`) MUST check a presence effect's `targetId` against S0
  actor ids, not only `combatantId`s. A presence effect on a seed NPC with no combatant passes.
- **FR-013**: Narration facts MUST include each landed presence change (actor name, new value,
  reason), so narrate may show a recorded flight. The fiction view in S1 already shows the value.

**Leaving the order (AC #3) (OQ-3)**

- **FR-014**: The engine MUST gain a command `initiative.leave { combatantId, reason }`. It
  removes the combatant from the active encounter's order and emits the existing
  `encounter.changed` event. It keeps the combatant's state.
- **FR-015**: `initiative.leave` MUST refuse `NO_ACTIVE_ENCOUNTER` with no encounter,
  `UNKNOWN_COMBATANT` for an unknown id, a not-in-order refusal for a combatant not in the order,
  and a refusal when the order would be empty. Every check runs before any die (refuse before
  draw). The exact refusal codes for "not in order" and "would empty" reuse existing codes where
  one fits; plan.md names them, and any new code is an OQ-4-class ruling.
- **FR-016**: When the leaving combatant is the active one, the next entry in the order becomes
  active. A wrap past the end increments the round, as `turn.advance` does. Resolve MUST then
  skip its own turn advance for that turn (User Story 3, scenario 2).
- **FR-017**: The `scene-presence` planner MUST plan the engine rows with the presence row in one
  atomic batch: `initiative.leave` when `after` is `absent` and the actor's combatant is in the
  order; `initiative.join` when the reason is `arrived`, an encounter is active, and the actor's
  combatant is not in the order. An engine refusal refuses the whole proposal.
- **FR-018**: The engine coverage meta-test MUST pass: the new command appears in a test.
  `specs/026-dnd5e-engine/contracts/commands.md` and the `dnd5e-engine` wiki note MUST record it.

**The snapshot (AC #4)**

- **FR-019**: `buildSnapshot` MUST read each actor's `presence` from the scene presence
  projection by actor id, defaulting to `present`. Party actors match by character id, NPC
  actors by NPC id, monster actors by combatant id.
- **FR-020**: `specs/040-actor-snapshot/contracts/actor-snapshot.md` rule 7 and its extension
  table MUST record that presence comes from the log. `SNAPSHOT_VERSION` stays 1: the field's
  meaning does not change.

**No Director field (AC #5)**

- **FR-021**: `DirectorOutput` MUST hold no presence field. A test MUST walk its schema and
  assert it, and a resolve test MUST assert no Director-group submission has kind
  `scene-presence`.

**Declare gate, absent (AC #6)**

- **FR-022**: The planner's `action.declare` case MUST refuse a character-scope declaration whose
  character is `absent` in the scene presence projection, with `CHARACTER_UNABLE` and
  `details: { characterId, reason: "absent" }`. `CHARACTER_UNABLE_REASONS` MUST gain `absent`.
- **FR-023**: A party-scope declaration MUST be refused when every character the proposer
  controls is absent or not conscious. `reason` is `absent` when any is absent, else
  `life-state`.
- **FR-024**: The absent check MUST run after `ACTION_EXISTS` and `NOT_AUTHORIZED`, beside the
  life-state check. The gate-api.md §1 `action.declare` row MUST name `reason: "absent"`.

**Plan gate, absent (AC #7) (OQ-4)**

- **FR-025**: `checkPlan` MUST fail an id whose S0 actor has `presence: "absent"`, with
  `PlanFailureReason` `absent`. The one exception is a presence effect with reason `arrived`.
- **FR-026**: An absent failure MUST resolve the action group `refused` with refusal code
  `UNKNOWN_COMBATANT` and record the verdict in the job result, as TASK-0112's other plan-gate
  reasons do.

**Docs**

- **FR-027**: `specs/031-dm-runtime/contracts/resolve.md` MUST describe the presence effect, the
  skipped turn advance and the absent plan-gate reason.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The declare gate MUST refuse a human, an AI companion and the
  scripted seat through the same `gate.handle` / `gate.submit` path, with the same code.
- **CR-002** (IV. Event-sourced play, server authority): Scene presence MUST be derived only by
  folding logged rows. Every refusal MUST leave the log unchanged. A presence change and its
  order change MUST land in one atomic batch.
- **CR-003** (VI. 5e engine boundary): The encounter order changes only through the engine
  (`initiative.leave`, `initiative.join`). An arrival's initiative is an engine roll. The engine
  stays pure, with no presence concept of its own.
- **CR-004** (VII. Structured before styled): The step grammar is a closed schema. Reasons are a
  closed list. No prose sets presence.
- **CR-005** (II. Content is a contract): Every frozen-contract edit carries an "Amended
  2026-10-27 (TASK-0141, operator ruling)" note, as TASK-0112 did.

### Key Entities

- **Scene presence**: per actor id, `present` (default), `yielded` or `absent`, with the reason
  and seq of the last change. Folded from `scene-presence.changed`.
- **Presence effect**: a step-grammar effect naming an S0 actor and a reason. Code derives the new
  value.
- **Order leave**: the engine command that takes a combatant out of the initiative order and
  keeps its state.
- **Absent refusals**: `CHARACTER_UNABLE` with `reason: "absent"` at the declare gate; plan-gate
  reason `absent` recorded under `UNKNOWN_COMBATANT`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a fake-gateway, scripted-dice replay of the M2 seq 296–301 shape, the goblins
  are `absent` in S1 only when an Intimidation check against them succeeded. With a failed check,
  0 presence rows land.
- **SC-002**: 0 `scene-presence.changed` rows come from a Director-group submission, in every
  resolve test.
- **SC-003**: After a combatant goes absent in turn mode, it takes 0 further turns, and every
  other combatant takes exactly 1 turn per round.
- **SC-004**: 0 declarations for an absent character land through the gate, for every proposer
  kind.
- **SC-005**: A reading with a step naming an S0-absent actor lands 0 rows from that reading.
- **SC-006**: The existing DM, session-model, engine and playtest suites pass. The shipped
  scenario's ci case still ends `ended` with a passing report.

## Card acceptance criteria mapping

| Card AC | Text (short) | Met by | Test owner |
|---|---|---|---|
| #1 | A catalogued event records a presence change with actor id, new value and reason | FR-001 to FR-007; User Story 1 | TASK-0141 |
| #2 | A step kind lets interpret and adjudicate propose a change; the gate applies it only through the engine, with tests | FR-008 to FR-013, FR-017; User Story 2 | TASK-0141 |
| #3 | An `absent` combatant leaves the encounter order through `combatant.remove` | FR-014 to FR-018; User Story 3 (OQ-3 amends the wording) | TASK-0141 |
| #4 | The snapshot reads scene presence from the log | FR-019, FR-020; User Story 4 | TASK-0141 |
| #5 | No Director field writes scene presence, with a test | FR-021; User Story 5 | TASK-0141 |
| #6 | The declare gate refuses an absent character with `CHARACTER_UNABLE` (`reason: "absent"`) and a test | FR-022 to FR-024; User Story 6 | TASK-0141 |
| #7 | A plan gate refuses a step whose actor or target is absent in S0, with a test and its refusal code ruled here | FR-025, FR-026; User Story 7; OQ-4 | TASK-0141 |

## Assumptions

- TASK-0112 merges first with the interfaces read from PR #71: `CHARACTER_UNABLE`,
  `CHARACTER_UNABLE_REASONS`, `checkPlan`, `PlanFailureReason`, settling. A change to them in
  review is merged in before phase 1.
- Party characters are engine combatants from scene start (spec 046 assumption). A party member
  with no combatant still carries presence by character id.
- No migration. No new runtime dependency. No ws-protocol frame change: the new row rides the
  existing event frame. The new proposal kind rides the existing gate request frame.
- Tests use the fake gateway and scripted dice. No paid provider run.

## Out of scope (each owned by a card)

- Enforcing a roll for another actor's presence change: TASK-0147 (U9).
- Director legality over `yielded`/`absent`, and the spotlight: TASK-0145 (U5).
- Claim gate on prose that shows an absent actor acting: TASK-0143 (U3).
- Seed NPC initial presence per beat, and the M2 seq 296–301 Snag test: TASK-0142 (U8).
- `dm.audit` reading S1 presence, and the F52 regression: TASK-0146 (U7).
- Position and range: TASK-0139 (revisit).

## Open questions

### Operator rulings (one-way doors; the spec is written against each default)

- **OQ-1 — the event and how it reaches the log (catalogue + frozen 029 text).**
  - (a) **Recommended.** A session-model event `scene-presence.changed` v1 (`state-change`,
    public), payload `{ actorId, before, after, reason, actionId }`, written by a new DM proposal
    kind `scene-presence` (`{ actorId, reason, actionId }`; the gate fills `before` and `after`).
    This follows the house pattern for stage state (`scene`, `party`, `tracker`, `table-mode`).
    It keys by any actor id, so TASK-0142's seed NPCs reuse it. Frozen text touched:
    `029/contracts/proposals.md` (13 to 14 kinds; DM kinds 11 to 12), `policy-and-authority.md`
    (one policy row, `ask`), `gate-api.md` §1 (one rows-table row); plus `028` session-events.md
    (additive). Precedent: TASK-0114 added `action.withdraw` the same way.
  - (b) Engine-owned presence: an engine state map, command `presence.set`, event
    `scene-presence.changed`, through the existing `mechanics` kind. No new proposal kind and no
    029 kind change. Cost: the pure 5e engine holds a non-SRD stage concept keyed by ids it
    cannot validate (party character ids, seed NPC ids with no combatant). `026` state, command
    and event contracts change.
  - (c) A presence field inside `action.resolved`. No new type. Rejected: the card asks for a
    catalogued event, and the NPC group has no action.
  - Name note: `presence.recorded` (decision-0024) already exists. The `scene-` prefix keeps the
    two apart, as decision-0025 "Terms" requires.
- **OQ-2 — the step grammar for AC #2.**
  - (a) **Recommended.** A new **effect** variant `{ effect: "presence", targetId, reason }`,
    usable in an `effect` step and in `onSuccess`, `onFailure` and `onHit`. It composes with a
    roll against the actor, which is how decision-0025 §2.2 wants flight and surrender gated.
    TASK-0147's batch gate and TASK-0112's plan gate already walk effect target ids. The card's
    "a step kind" is read as "the step grammar".
  - (b) A new **step** kind `{ step: "presence", targetId, reason }`. It matches the card
    wording literally. It cannot sit under a roll's outcome, so a dared goblin's flight would be
    a separate, unconditioned step. That defeats Formulation 3.
- **OQ-3 — how an absent combatant leaves the order (engine contract; card AC #3 wording).**
  `combatant.remove` refuses a combatant in the active encounter and deletes its state.
  - (a) **Recommended.** A new engine command `initiative.leave` that takes the combatant out of
    the order and keeps its state (event: the existing `encounter.changed`). An arrival rejoins
    through `initiative.join`. The snapshot keeps the absent actor with its HP. Amend card AC #3
    to read "leaves the encounter order through an engine command".
  - (b) Amend `combatant.remove` to drop an encounter member from the order (AC #3 literal). The
    combatant's state is deleted: the snapshot loses the actor unless the presence projection
    keeps a name stub, and a returning goblin comes back at full HP. A party member who leaves
    loses HP, hit dice and slots. `COMBATANT_IN_ENCOUNTER` then needs a new meaning or goes
    unused.
- **OQ-4 — the plan-gate refusal code for an absent actor (AC #7).** `action.resolved.refusalCode`
  is the engine's `RefusalCodeSchema`, so the code must be an engine code.
  - (a) **Recommended.** Reuse `UNKNOWN_COMBATANT`, with plan-gate reason `absent` in the job
    result. This is what TASK-0112's plan gate already does for `not-a-combatant`. No frozen text
    changes. Cost: the code says "unknown" for an actor the engine still holds.
  - (b) A new engine code `ACTOR_ABSENT` (28 codes). Amends `026` refusals.md, `029` gate-api.md
    §2's count and the `028` note. Cost: under OQ-1 (a) and OQ-3 (a) the engine has no presence
    concept, so the engine itself never emits it. Only the server plan gate does.
  - (c) Reuse `ACTOR_UNABLE`. Rejected: it is defined for an unable attacker or checker, and an
    absent target is neither.

### Interpretive choice (default stated; needs a card if overruled)

- **OQ-5 — a yielded actor resuming opposition.** The card's reason list cannot move `yielded`
  back to `present`. Default: not expressible in this card. If the table needs a goblin that
  surrenders and then fights again, the orchestrator cards a reason (for example `resumed`) with
  its trigger: a measured run shows the need.
