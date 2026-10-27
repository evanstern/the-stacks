# Feature Specification: Downed hero gate and able-actor gates

**Feature Branch**: `task-0112-downed-hero-gate`
**Spec dir**: `specs/046-downed-hero-gate`
**Created**: 2026-10-27
**Status**: Draft — STOPPED after spec.md for operator rulings OQ-1 and OQ-2 (one-way doors)
**Board card**: TASK-0112 (Track C5, runbook amendment 1, U6 folded in)
**Input**: TASK-0112, decision-0025 (D17) card U6, evidence
`specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/classification.md` R2.

## Governing decision

This card implements decision-0025 (D17, "Actor-state rule gate", TASK-0135) card **U6, the
able-actor gates**. It implements these rules:

- **§3.1 input gate, declare half.** The declare gate refuses a character that is not
  `conscious` or is `absent`. The NPC-turn and companion life-state skips stay.
- **§3.2 plan gates.** Every step's actor and target must exist in S0 and must not be
  `absent`. The engine refuses an unconscious, stable or incapacitated attacker or checker,
  beside the existing dead-actor refusals.
- **§3.1, last sentence, turn-order half only.** In turn mode the active turn never waits on a
  downed actor's declaration (User Story 3). The free-mode spotlight is Director legality,
  TASK-0145 (U5).

It answers card AC #2 by citation. Decision-0025 "Consequences" states: "TASK-0112 acceptance
criterion #2 is answered here: an unconscious character's declared action is refused at the
declare gate, before any model runs." No new decision record is needed.

It implements none of these: the batch gate (§3.3, TASK-0147), the claim gate (§3.4,
TASK-0143), Director legality (§2.5, TASK-0145), scene presence and its producer (TASK-0141,
U2), seed-NPC presence (TASK-0142, U8).

**Builds on**:

- TASK-0140 (spec 040, merged). `assemble` builds S0 and `resolve` builds S1
  (`apps/server/src/dm/snapshot/`, wiki note `actor-snapshot`). Its extension points name this
  card: "TASK-0112 checks plan step ids against S0".
- TASK-0110 (spec 045, PR #67, merged 2026-10-27 09:57 UTC after this branch was cut). It moved
  the action groups before the Director group, except encounter start and scene-start setup
  (045 FR-003). Spec 045 names the evidence's `UNKNOWN_COMBATANT` refusal (an interpret step
  naming a non-combatant, likely the captive seed NPC `pell`) as this card's AC #5. The first
  implementation phase merges `origin/main` in before touching `resolve.ts`.

**Clarify**: skipped. The card, decision-0025 and the evidence settle the behaviour. Two
choices change frozen contract text; they are raised as operator rulings OQ-1 and OQ-2, not
asked as preferences. Interpretive choices with a stated default are OQ-3 to OQ-5.

## Root cause (from the evidence)

Run 20261026T192319Z, R2. Tamsin Vale (the scripted human seat) dropped to 0 HP in round 2.

| Seq | Row | What it shows |
|---|---|---|
| 154–158 | seat declares "I swing my longsword…"; interpret reads it as a death saving throw (`check.roll`, `saving-throw`, DC 10, `tamsin`) | **Death saves ride on the seat's declaration.** No code path rolls one. The model invents a `check.roll` that is not an engine death save (no `death-saves.changed`). |
| 174–182 | seat declares "I crouch and study the mud"; the DM redirects the search to Kestrel | the gate accepted an unconscious character's declaration |
| 197–201 | seat declares "I offer a fair trade…"; `no-effect`; the narrator shows she cannot speak; audit flags player-agency three times; fallback | R2, fallback turn |
| 207–216 | "edge toward the reed camp", "ready my sword"; same pattern | R2, fallback turn |

Three defects show:

1. **The driver** (`apps/server/src/playtest/driver.ts`, `nextMove`) never reads the seat
   character's life state. It declares while Tamsin is at 0 HP.
2. **The declare gate** (`packages/session-model/src/gate/plan.ts`, `action.declare`) checks
   only `ACTION_EXISTS` and control. It accepts any declaration for a downed character.
3. **No death-save turn exists.** In turn mode the active actor stays on the downed seat's
   user, and the turn waits for a declaration. Fixing defects 1 and 2 alone would stall every
   turn-mode fight the moment a hero drops. That is why card AC #6 exists.

The engine (`packages/dnd5e-engine/src/commands/attacks.ts`, `checkNamed`) refuses an unknown
or dead attacker, target or checker. It accepts an unconscious, stable or incapacitated one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The scripted seat stops acting for a downed hero (Priority: P1)

A playtest run reaches a point where the seat's character is at 0 HP or unconscious. The
driver no longer declares moves for that character. In turn mode the run carries on: the
fight plays out around the hero, death saves included. In free mode, or once the fight ends
with the hero still down, the run ends as `stalled` with a stated reason.

**Why this priority**: It is the card's outcome. R2 caused two of the six fallback turns in the
evidence run (seq 201, 216).

**Independent Test**: Driver unit tests over hand-built projections, plus one harness test in
ci mode (fake gateway, scripted dice) that drops the seat to 0 HP.

**Acceptance Scenarios**:

1. **Given** projections where the seat character's combatant has `hp.current` 0 or a life
   state other than `conscious`, **When** `nextMove` runs in free mode, **Then** it returns
   `"done"` and the harness records `stalled` with `stallReason: "seat-downed"`.
2. **Given** the same character in turn mode, with the active character someone else, **When**
   `nextMove` runs, **Then** it returns `"wait"`.
3. **Given** the seat character is conscious again (healed, or a natural 20 on a death save),
   **When** `nextMove` runs, **Then** it declares as before.
4. **Given** a ci-mode run whose scripted dice drop the seat to 0 HP in turn mode, **When** the
   run continues, **Then** no `action.declared` row names the seat character while it is at
   0 HP, **and** the harness never records a declare refusal for the seat.

---

### User Story 2 - The declare gate refuses a downed character (Priority: P1)

A player, a companion or the scripted seat tries to declare an action for a character that is
not conscious. The gate refuses the declaration before any row is written and before any DM
model runs. The refusal carries a stable code that names the reason.

**Why this priority**: Decision-0025 §3.1. It is the server-authoritative half; the driver fix
covers only the harness, not a human at the table.

**Independent Test**: Planner unit tests in `packages/session-model` over fixture projections,
plus a server gate test through `gate.handle`.

**Acceptance Scenarios**:

1. **Given** a party character whose combatant life state is `unconscious`, `stable` or
   `dead`, **When** its controller submits a character-scope `action.declare`, **Then** the
   gate refuses with source `gate` and the able-actor code (OQ-1), with `details`
   `{ characterId, reason: "life-state", lifeState }`, and the log is unchanged.
2. **Given** a conscious character, **When** its controller declares, **Then** the gate
   accepts it as today.
3. **Given** a party member with no combatant (no tracked life state), **When** it declares,
   **Then** the gate accepts it.
4. **Given** a player all of whose controlled characters are not conscious, **When** the player
   submits a party-scope `action.declare`, **Then** the gate refuses with the same code and
   `reason: "life-state"`.
5. **Given** the play route, **When** a downed player's declaration is refused, **Then** the
   composer shows the existing refusal notice (`message (code)`). No client change is needed.

---

### User Story 3 - Death-save turns still run (Priority: P1)

In turn mode, the turn reaches a party member at 0 HP. Code, not a model, runs that
character's death saving throw through the engine (`death-save.roll`). The turn then passes
to the next combatant. A stable or dead character's turn passes with no roll. A natural 20
brings the character back to 1 HP. That character is then conscious, so the turn stays and
its controller acts.

**Why this priority**: Card AC #6. Without it, User Stories 1 and 2 stall every fight in which
a hero drops. It also replaces the evidence's invented death save (seq 156–157) with a real
engine death save.

**Independent Test**: Resolve node tests with the fake gateway and scripted dice, over
fixtures where the next combatant in the order is a downed party member.

**Acceptance Scenarios**:

1. **Given** turn mode and the turn advancing to a party combatant with life state
   `unconscious` and `zeroHpRule: "death-saves"`, **When** resolve runs its turn-advance
   group, **Then** it submits `death-save.roll` for that combatant, then `turn.advance`
   again. The table mode lands on the next combatant that can act.
2. **Given** the same combatant at `stable`, **When** the turn reaches it, **Then** the turn
   passes with no roll.
3. **Given** a scripted natural 20, **When** the death save resolves, **Then** the combatant
   is at 1 HP and `conscious`. The table mode lands on it with its controller as the active
   actor, and no further advance runs.
4. **Given** a third failed death save, **When** it resolves, **Then** the combatant is
   `dead` and the turn passes.
5. **Given** an encounter start whose first combatant in the order is a downed party member,
   **When** the Director group sets the first active actor, **Then** the same settling runs.
6. **Given** a non-party combatant (monster or NPC combatant) that is `unconscious` or
   `stable`, **When** the turn reaches it, **Then** the turn passes with no roll and no NPC
   turn job is queued for it.
7. **Given** any of these turns, **When** narrate runs, **Then** the death-save roll and its
   outcome are narration facts and dice lines, so the playtest `dice-lines` check passes.

---

### User Story 4 - The engine refuses an unable attacker or checker (Priority: P2)

An interpret or adjudicate step, or a DM command, names an attacker or an ability checker that
is unconscious, stable or incapacitated. The engine refuses the command before it draws a die.

**Why this priority**: Decision-0025 §3.2. It closes the model's path around the declare gate
(an NPC-turn or companion step that names a downed actor). It is P2 because the input gates
catch the evidence's case first.

**Independent Test**: Engine unit tests with `scriptedRng`. The coverage meta-test requires
the new code to appear in a test.

**Acceptance Scenarios**:

1. **Given** an attacker whose life state is `unconscious` or `stable`, **When**
   `attack.roll` runs, **Then** the engine refuses with the actor-unable code (OQ-2),
   `details: { combatantId, role: "attacker", lifeState, conditions }`, and draws no die.
2. **Given** an attacker with the condition `incapacitated`, `paralyzed`, `petrified`,
   `stunned` or `unconscious`, **When** `attack.roll` runs, **Then** the engine refuses the
   same way.
3. **Given** an `ability-check` whose `combatantId` is unable in either way, **When**
   `check.roll` runs, **Then** the engine refuses with `role: "checker"`.
4. **Given** a `saving-throw` by an unable combatant, **When** `check.roll` runs, **Then** the
   engine accepts it (OQ-3).
5. **Given** a dead attacker or checker, **When** either command runs, **Then** the engine
   still refuses `TARGET_DEAD` first. The order is unknown, then dead, then unable.
6. **Given** `attackerId: null` or `combatantId: null`, **When** either command runs, **Then**
   no able-actor check applies.
7. **Given** an unconscious target, **When** an attack names it, **Then** the engine accepts
   it. Attacking a downed creature is legal.

---

### User Story 5 - The plan gate refuses a step naming an unknown actor (Priority: P2)

Interpret or adjudicate returns steps for an action. One step names an actor or target id that
no engine-backed actor in S0 holds: for example the seed NPC `pell`, who has no combatant.
Before resolve writes anything for that action, the plan gate refuses the whole action group.
The action resolves `refused` with `UNKNOWN_COMBATANT`, and none of its steps land.

**Why this priority**: Decision-0025 §3.2 and spec 045's root cause. Today the engine refuses
the same step mid-chain: earlier steps of the group may already have landed, and the refusal
arrives after other writes.

**Independent Test**: Pure plan-gate unit tests over S0 fixtures, plus resolve node tests with
the fake gateway.

**Acceptance Scenarios**:

1. **Given** a reading whose first step is an effect on `pell` (an S0 `npc` actor with no
   `combatantId`), **When** the plan gate runs, **Then** the action group is refused with
   `UNKNOWN_COMBATANT` and `details: { stepIndex, field, id, reason: "not-a-combatant" }`.
2. **Given** a step naming an id that matches no S0 actor at all, **When** the plan gate runs,
   **Then** the group is refused with `reason: "not-in-snapshot"`.
3. **Given** a reading whose step 0 is a valid check and step 1 names `pell`, **When**
   resolve runs, **Then** no row from step 0 lands, and the action resolves `refused`.
4. **Given** an attack on `goblin-2` in free mode on a turn whose Director decision starts the
   encounter that adds `goblin-2`, **When** the plan gate runs, **Then** it accepts the step
   (OQ-4). Spec 045 SC-003 still holds.
5. **Given** a refused NPC-turn group, **When** resolve runs, **Then** the NPC turn has no
   effect and the turn still advances.
6. **Given** a reading whose steps all name S0 combatants, **When** the plan gate runs,
   **Then** resolve behaves exactly as before. The existing DM suite passes with no prompt
   fixture change.

---

### Edge Cases

- The seat character has no combatant (free mode before any combatant exists). The driver and
  the gate treat it as able: no life state is tracked.
- The seat is healed back to consciousness by a companion in turn mode. The driver resumes on
  its next active turn (User Story 1, scenario 3).
- A party member drops on its own turn mid-action. The action resolves, and the turn advances
  as today. The settling applies to the next combatant.
- Every non-dead combatant in the order is unable (for example, all stable). Settling stops
  after one full lap. The table mode rests on the last combatant reached, and the encounter
  waits for the Director to end it (TASK-0145). This case is not reachable in the shipped
  scenario. A test pins the lap bound so the loop cannot spin.
- A declaration already open (`declared` or `discussed`) when its character drops. The gate
  does not retroactively refuse it. If it is committed, the engine and plan gates refuse its
  unable-actor steps. OQ-5 asks whether to withdraw it.
- A downed AI companion. The companion job's life-state skip stays (§3.1). The turn order no
  longer lands on it, because settling passes its turn.
- A legacy log whose `action.resolved` rows carry only today's codes still parses. The new
  engine code is additive.

## Requirements *(mandatory)*

### Functional Requirements

**Driver (AC #1)**

- **FR-001**: `nextMove` MUST treat the seat character as downed when its party member's
  combatant has `hp.current === 0` or a `lifeState` other than `conscious`.
- **FR-002**: A downed seat in free mode MUST make `nextMove` return `"done"`. The harness
  MUST record `outcome: "stalled"` with `stallReason: "seat-downed"`
  (`STALL_REASON_SEAT_DOWNED` beside `STALL_REASON_SEAT_EXHAUSTED`).
- **FR-003**: A downed seat in turn mode MUST make `nextMove` return `"wait"` unless the seat
  character is active. Settling (FR-010) never makes a downed seat active.
- **FR-004**: The scenario contract (`specs/032-playtest-harness/contracts/scenario.md`
  "Driver") MUST state the downed rule and the new stall reason.

**Declare gate (AC #2, AC #3)**

- **FR-005**: AC #2 is met by decision-0025 "Consequences". The card's final summary MUST cite
  it.
- **FR-006**: The planner's `action.declare` case MUST refuse a character-scope declaration
  whose character has a combatant with `lifeState` other than `conscious`. The refusal source
  is `gate`. The code is the able-actor code ruled at OQ-1. `details` MUST carry
  `{ characterId, reason: "life-state", lifeState }`.
- **FR-007**: The planner MUST refuse a party-scope declaration when the proposer controls at
  least one party character and every one it controls is not conscious. The code and reason
  are the same as FR-006.
- **FR-008**: The check MUST run after `ACTION_EXISTS` and after control (`NOT_AUTHORIZED`), so
  an unauthorised proposer still sees `NOT_AUTHORIZED`.
- **FR-009**: The `reason` field MUST be an open set. TASK-0141 adds `reason: "absent"` under
  the same code (see Sequencing).

**Death-save turns (AC #6)**

- **FR-010**: Resolve MUST settle the active turn wherever it lands turn mode on a combatant:
  after a turn advance, and after the encounter start sets the first active actor. Settling
  loops over the active combatant:
  1. Stop when the combatant can act (`conscious` and no incapacitating condition from FR-013).
  2. If it is `unconscious` with `zeroHpRule: "death-saves"`, submit `death-save.roll` for it.
     Stop if it is now `conscious` (a natural 20).
  3. Otherwise submit `turn.advance` and repeat.
- **FR-011**: Settling MUST be bounded by one lap of the encounter order. It MUST then set the
  table mode for the combatant it stopped on, with `activeActorFor`, and queue the next job by
  the existing rule.
- **FR-012**: Settling MUST be code only. No model chooses a death save, its expression or its
  outcome. Every number comes from the engine.

**Engine (AC #4)**

- **FR-013**: The engine MUST define a combatant as **unable** when its `lifeState` is
  `unconscious` or `stable`, or it holds any of the conditions `incapacitated`, `paralyzed`,
  `petrified`, `stunned`, `unconscious`. These conditions carry Incapacitated under SRD 5.2.1.
- **FR-014**: `attack.roll` MUST refuse an unable `attackerId`. `check.roll` with
  `kind: "ability-check"` MUST refuse an unable `combatantId`. Both use the code ruled at OQ-2,
  with `details: { combatantId, role, lifeState, conditions }`.
- **FR-015**: The check order MUST be: unknown (`UNKNOWN_COMBATANT`), then dead (`TARGET_DEAD`),
  then unable. Every check MUST run before the first `rollDie` (refuse-before-draw).
- **FR-016**: `check.roll` with `kind: "saving-throw"` MUST NOT apply the unable check (OQ-3).
- **FR-017**: The engine's coverage meta-test MUST pass: the new code appears in a test.

**Plan gate (AC #5, S0 half)**

- **FR-018**: A pure function MUST check every step of every interpret reading and adjudicate
  ruling against S0, before resolve writes anything. The checked ids are `attackerId`,
  `targetId`, a check's `combatantId`, and every effect `targetId` (including `onHit`,
  `onSuccess` and `onFailure`).
- **FR-019**: An id passes when an S0 actor has that `combatantId`, or when the turn's
  Director decision starts an encounter whose seed monsters include it (OQ-4). Every other id
  fails: `not-a-combatant` when it matches an S0 actor's `id` or alias with no `combatantId`,
  else `not-in-snapshot`. The gate MUST NOT map an alias to a combatant id
  (`dm-failure-and-gates`: "A gate never maps, coerces or drops a term to pass output").
- **FR-020**: A failing action group MUST resolve `refused` with refusal code
  `UNKNOWN_COMBATANT` and run none of its steps. A failing NPC group MUST run no steps, and the
  turn MUST still advance.
- **FR-021**: The verdict MUST be recorded in the job result beside the action results, so the
  debug view and the failed-turn record show which step and id failed.
- **FR-022**: The plan gate MUST NOT re-ask interpret in this card (OQ-5 asks whether a later
  card should).

**Contracts and docs**

- **FR-023**: `specs/040-actor-snapshot/contracts/actor-snapshot.md` "Extension points" MUST
  record the plan gate as built.
- **FR-024**: `specs/031-dm-runtime/contracts/resolve.md` MUST describe settling and the plan
  gate in its order of work.
- **FR-025**: The frozen-contract edits ruled at OQ-1 and OQ-2 MUST land in this card's PR,
  with the ruling quoted on the card.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The declare gate MUST refuse an AI companion, the scripted
  seat and a human through the same `gate.handle` / `gate.submit` path, with the same code.
- **CR-004** (VI. 5e engine boundary): Death saves MUST run only through the engine's
  `death-save.roll`. The unable-actor refusal MUST live in the engine package, which stays
  pure (no I/O, refuse-before-draw). No model rolls or computes a number.
- **CR-006** (IV. Event-sourced play, server authority): Every refusal MUST leave the log
  unchanged. Death saves land as engine events through the gate. No new event type is added.

### Key Entities

- **Unable combatant**: an engine combatant whose life state or conditions forbid acting
  (FR-013). Engine-owned.
- **Able-actor refusal**: the gate refusal of a declaration (OQ-1 code) with a `reason`
  (`life-state` here, `absent` in TASK-0141).
- **Plan-gate verdict**: per action group and NPC group, `ok` or `refused` with step index,
  field, id and reason.
- **Settling**: resolve's code-only loop that passes or death-saves unable combatants' turns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a ci-mode run that drops the seat to 0 HP, 0 `action.declared` rows name the
  seat character while it is down.
- **SC-002**: 0 declarations for a non-conscious character land through the gate, for every
  proposer kind (human, companion, scripted seat).
- **SC-003**: A downed party member's turn in turn mode produces exactly 1 engine death-save
  roll (or 0 when stable or dead), and the turn passes with no human input.
- **SC-004**: 0 dice are drawn by a refused unable-actor command (refuse-before-draw).
- **SC-005**: A reading with a step naming a non-combatant lands 0 rows from that reading.
- **SC-006**: Spec 045 SC-003 still holds: 0 `UNKNOWN_COMBATANT` refusals for an ambush attack.
- **SC-007**: The existing DM and playtest suites pass with no prompt fixture change, and the
  shipped scenario's ci case still ends `ended` with a passing report.

## Card acceptance criteria mapping

| Card AC | Text | Met by | Owner of the test |
|---|---|---|---|
| #1 | Driver does not declare for a seat character at 0 HP or unconscious, with a test | FR-001 to FR-004; User Story 1 | TASK-0112 |
| #2 | A decision records whether an unconscious character's declared action is refused before narration | decision-0025 "Consequences"; FR-005 | TASK-0112 (citation) |
| #3 | Declare gate refuses a character that is not conscious **or is absent** | life-state half: FR-006 to FR-009, User Story 2. Absent half: TASK-0141 | life-state: TASK-0112. Absent: TASK-0141 (recommended split) |
| #4 | Engine refuses an unconscious, stable or incapacitated attacker or checker | FR-013 to FR-017; User Story 4 | TASK-0112 |
| #5 | Plan gate refuses a step whose actor or target is missing from S0 **or absent** | S0 half: FR-018 to FR-022, User Story 5. Absent half: TASK-0141 | S0: TASK-0112. Absent: TASK-0141 (recommended split) |
| #6 | Death-save turns for unconscious PCs still run | FR-010 to FR-012; User Story 3 | TASK-0112 |

## Sequencing: the "absent" halves of AC #3 and AC #5

Scene presence (`present`, `yielded`, `absent`) does not exist yet. U1 sets every actor's
`presence` to `present`. TASK-0141 (U2, Track C6) adds the state and its producer. It is
ordered after this card.

**Option A (recommended default): split.** This card ships the life-state declare gate and the
S0 plan gate. TASK-0141 ships both absent checks.

- This card defines the able-actor gate code (OQ-1) with an open `reason`. TASK-0141 adds
  `reason: "absent"` under the same code, so it opens no second one-way door for the declare
  gate.
- TASK-0141 adds the absent plan-gate check to this card's pure plan-gate function, with
  `reason: "absent"`. It needs an engine refusal code for an `action.resolved` row, because
  `refusalCode` is the engine's `RefusalCodeSchema`. That code is TASK-0141's own ruling.
- Test ownership:
  - TASK-0112 owns: driver tests (AC #1); declare gate life-state tests (AC #3); engine
    unable-actor tests (AC #4); plan gate S0 tests (AC #5); settling tests (AC #6).
  - TASK-0141 owns: declare gate absent test (AC #3, `reason: "absent"`); plan gate absent
    test (AC #5, an actor or target with `presence: "absent"` in S0).
- Card edits the orchestrator makes: on TASK-0112, re-word AC #3 and AC #5 to their life-state
  and S0 halves, and remove the TASK-0141 dependency. On TASK-0141, add two ACs: "The declare
  gate refuses an absent character with `reason: absent`, with a test (decision-0025 §3.1)"
  and "The plan gate refuses a step whose actor or target is absent in S0, with a test
  (decision-0025 §3.2)". Add TASK-0112 to TASK-0141's dependencies.
- Why: the absent check is a predicate on a field TASK-0141 creates. Its test needs that
  card's producer to make `absent` reachable. The split leaves no deferral without a card.

**Option B: reorder.** TASK-0141 lands first. This card then ships both halves. Cost: C5
waits for C6. TASK-0141's spec is not written yet. The demo subset still needs both, so
the demo date does not move, but this card's lane idles.

## Assumptions

- Party characters are engine combatants from scene start, so `p.party[*].combatant` carries
  life state in free mode too. A member with `combatant: null` is treated as able.
- `hp.current === 0` and `lifeState !== "conscious"` agree for an engine combatant
  (`CombatantSchema` refinements). The driver checks both, as the card wording does.
- A death save is the SRD start-of-turn roll. Settling runs it when the turn reaches the
  combatant, not at the end of the previous turn.
- Free mode has no death saves. The card's AC #6 covers turn mode only.
- No new runtime dependency. No migration. No new session-model event type. No ws-protocol
  frame change. The new `stallReason` value is additive to the 032 manifest, which is not
  frozen.

## Out of scope (each owned by a card)

- Scene presence and both absent checks: TASK-0141 (Option A).
- Free-mode spotlight on a downed actor, and Director legality: TASK-0145 (U5).
- Auto-failure of Strength and Dexterity saves for an unconscious creature: the engine does
  not derive auto-failure from conditions (R8). No card asks for it in M3.
- The resolve batch gate: TASK-0147 (U9). The claim gate: TASK-0143 (U3).

## Open questions

### Operator rulings required (one-way doors; this spec stopped here)

- **OQ-1 — the declare gate's refusal code (frozen 029 text).** FR-006 needs a refusal code.
  `GateRefusalCodeSchema` (`packages/session-model/src/gate/refusals.ts`) and the code list in
  frozen `specs/029-proposal-gate/contracts/gate-api.md` §2 hold 15 codes. The §1 Rows table
  lists `action.declare`'s checks.
  - (a) **Recommended.** Add one gate code, `CHARACTER_UNABLE`, with `details.reason`
    `"life-state"` (TASK-0141 adds `"absent"`). Amend gate-api.md §1 (`action.declare` row) and
    §2 (code list). The client needs no change; it shows `message (code)`.
  - (b) Reuse `NOT_AUTHORIZED` with `details.reason`. No frozen text changes. The code then
    means both "not yours" and "cannot act", and a client cannot tell them apart.
  - (c) Add two codes, `CHARACTER_NOT_CONSCIOUS` now and `CHARACTER_ABSENT` in TASK-0141. This
    is clearer per code, but it spends a second frozen-contract amendment in TASK-0141.
- **OQ-2 — the engine's unable-actor refusal code (frozen 029 text, session-model payload).**
  FR-014 needs an engine `RefusalCode`. Frozen gate-api.md §2 says the engine source carries
  "the engine's 26 `RefusalCode`s, unchanged". The `action.resolved` payload's `refusalCode`
  is the engine's `RefusalCodeSchema`, so a new code also widens that event schema
  (additive; old rows still parse).
  - (a) **Recommended.** Add `ACTOR_UNABLE` to `RefusalCodeSchema` (27 codes). Amend gate-api.md
    §2's count, `specs/026-dnd5e-engine/contracts/refusals.md` and the `dnd5e-engine` wiki note.
  - (b) Reuse `TARGET_DEAD` for unable actors. No contract text changes, but the code lies
    about the state, and narration reads it as a death.
  - (c) Move the refusal out of the engine, into the server plan gate only. No engine change.
    This contradicts AC #4 ("the engine refuses") and decision-0025 §3.2.

### Interpretive choices with a stated default (non-blocking)

- **OQ-3 — saving throws by an unable creature.** Default: allowed (FR-016). SRD 5.2.1 has
  unconscious creatures make saves. Under decision-0025 §2.2 a save is often the roll against
  that actor, so refusing it would block legal harm. The alternative refuses every
  `check.roll` by an unable combatant, the literal reading of "checker".
- **OQ-4 — ambush combatants at plan time.** Default: an id passes when the turn's Director
  decision adds it at encounter start (FR-019). This keeps spec 045 SC-003. The literal reading
  of "exist in S0" would refuse every free-mode attack that starts a fight.
- **OQ-5 — interpret re-ask and open declarations.** Default: no re-ask on a plan-gate refusal
  (FR-022), and no withdrawal of a declaration left open when its character drops. Either can
  be a later card if a measured run shows the refusals hurt narration.
