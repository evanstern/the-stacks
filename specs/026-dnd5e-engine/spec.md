# Feature Specification: First Scene — pure 5e engine package

**Feature Branch**: `task-0042-dnd5e-engine`

**Created**: 2026-10-25

**Status**: Draft

**Input**: Board card TASK-0042 ("First Scene: pure 5e engine package"), M2 First Scene sweep,
lane 1. Grounding: architecture A6, A10, A11; decision-0010, decision-0015, decision-0017,
decision-0020, decision-0021; constitution 2.0.0 (principles I, IV, VI).

**Clarify pass**: skipped. Every open point had a default an existing artifact settles: the
rules baseline is SRD 5.2.1 (decision-0012), the boundary shape is decision-0010 plus
constitution VI, and the ledger shape is decision-0021 idea 2. The defaults chosen are listed
under Assumptions.

## Context

The engine owns every number in a game of 5e. The language model owns story and never rolls
dice or does arithmetic (decision-0017 layer 2, decision-0021 idea 1). The gate (TASK-0045)
wraps the engine, the session model (TASK-0044) stores its events as the roll ledger, and the
DM runtime (TASK-0046) reaches mechanics only through proposals that the gate passes to the
engine. This feature delivers the engine alone: one pure function with no I/O.

The "users" of this feature are therefore three kinds of caller: the gate, the session
projections, and a test author who needs reproducible dice. The human player and the AI DM
benefit indirectly: every number they see is computed, logged and auditable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Roll any 5e dice expression reproducibly (Priority: P1)

A caller asks the engine to roll a dice expression such as `1d20+5`, `4d6kh3` or `2d6+1d4+3`,
optionally with advantage or disadvantage, and gives a reason. The engine returns one roll
event that records the expression, every die face, which faces were kept, the total and the
reason. With the same seed, the same command always gives the same faces. A test can script
the exact faces.

**Why this priority**: every other mechanic (damage rolls, initiative, death saves, hit dice)
rolls dice. Without a reproducible roller nothing else is testable.

**Independent Test**: call the entry point with a `roll` command and a scripted RNG; assert the
roll event's faces, kept faces and total. Repeat with the same seed and assert identical events.

**Acceptance Scenarios**:

1. **Given** a scripted RNG returning 6, 2, 5, 3, **When** the caller rolls `4d6kh3`,
   **Then** the event keeps 6, 5, 3, drops 2 and totals 14.
2. **Given** a scripted RNG returning 4 then 17, **When** the caller rolls `1d20+3` with
   advantage, **Then** the event shows both d20 faces, keeps 17, records natural 17 and
   totals 20.
3. **Given** two seeded RNGs built from the same seed, **When** the same command runs against
   each, **Then** both results are deeply equal.
4. **Given** the expression `3d`, **When** the caller rolls it, **Then** the engine returns
   refusal `INVALID_DICE_EXPRESSION` and no events.

---

### User Story 2 - Track hit points, life states and death saves (Priority: P1)

A caller adds combatants to the engine state, then applies damage, healing and temporary hit
points. Each change produces an event with before and after values. A creature that drops to
0 HP becomes unconscious and makes death saves, or dies outright if its rule says so. Death
saves resolve success, failure, stabilisation, death and the natural-20 recovery.

**Why this priority**: hit points and life states are the core of every fight in the First
Scene. They are the numbers the narrator most often reports.

**Independent Test**: add a combatant, apply a damage command with a scripted roll, and assert
the `hp.changed` event's before and after values and the resulting life state.

**Acceptance Scenarios**:

1. **Given** a combatant with 10 HP and 5 temporary HP, **When** it takes 8 damage, **Then**
   the event shows before {current 10, temp 5} and after {current 7, temp 0}.
2. **Given** a combatant using death saves at 3 HP, **When** it takes 5 damage, **Then** it
   reaches 0 HP, its life state changes from conscious to unconscious and it gains the
   Unconscious condition.
3. **Given** an unconscious combatant with 2 failed death saves, **When** a death save rolls
   a 7, **Then** it records the third failure and its life state changes to dead.
4. **Given** a dead combatant, **When** a caller applies healing, **Then** the engine returns
   refusal `TARGET_DEAD` and no events.

---

### User Story 3 - Apply, list and remove conditions as data (Priority: P2)

A caller applies a condition (for example Poisoned, with a source and an optional expiry
point) to a combatant, lists a combatant's conditions, and removes a condition. Exhaustion
carries a level from 1 to 6. The engine stores conditions as records; it does not hard-code
their game effects.

**Why this priority**: conditions are the most common non-HP state in play, and audit needs
them in the ledger. Their effects on rolls are applied by adjudication, which sets the roll
mode it asks for.

**Independent Test**: apply Poisoned, list it through the selector, remove it, and assert both
events and the final empty list.

**Acceptance Scenarios**:

1. **Given** a combatant with no conditions, **When** Poisoned is applied, **Then** a
   `condition.applied` event carries the new instance as its after value.
2. **Given** a Poisoned combatant, **When** Poisoned is applied again, **Then** the engine
   returns refusal `CONDITION_ALREADY_PRESENT`.
3. **Given** a combatant at exhaustion level 5, **When** exhaustion rises by 1, **Then** the
   level becomes 6 and the combatant's life state becomes dead.

---

### User Story 4 - Run initiative and turn order (Priority: P2)

A caller starts an encounter by rolling initiative for a list of combatants. The engine orders
the turns, names the active combatant, and advances turns and rounds on command. Dead
combatants are skipped. Conditions that expire at a turn boundary are removed as the boundary
passes. A combatant can join a running encounter. The caller can end the encounter.

**Why this priority**: turn mode (decision-0016) needs an active combatant to decide commit
authority, and the First Scene's encounter needs an order.

**Independent Test**: start an encounter for three combatants with scripted d20s, assert the
order and the active combatant, advance three times and assert round 2 begins.

**Acceptance Scenarios**:

1. **Given** combatants with scripted initiative totals 12, 18 and 12, **When** the encounter
   starts, **Then** the 18 goes first and the tie breaks by initiative bonus, then by id.
2. **Given** the last combatant in round 1 is active, **When** the turn advances, **Then**
   round 2 starts with the first combatant in the order.
3. **Given** no active encounter, **When** a caller advances the turn, **Then** the engine
   returns refusal `NO_ACTIVE_ENCOUNTER`.

---

### User Story 5 - Resolve rests and spell slots (Priority: P3)

A caller resolves a short rest (spending named hit dice to heal, and restoring pact slots) and
a long rest (full HP, all hit dice, all spell slots, temporary HP cleared, exhaustion reduced
by one). A caller expends a spell slot of a level and restores one outside a rest.

**Why this priority**: rests close a scene and spell slots gate casters. They matter less in a
single First Scene than HP and turns, but the card scopes them in.

**Independent Test**: expend two level-1 slots, run a long rest, and assert slot and HP events
with before and after values.

**Acceptance Scenarios**:

1. **Given** a wizard with 2 of 2 level-1 slots expended, **When** a caller expends a level-1
   slot, **Then** the engine returns refusal `NO_SLOT_AVAILABLE`.
2. **Given** a fighter with 3 of 5 d10 hit dice remaining and Con +2, **When** it spends 2
   hit dice with scripted faces 4 and 7, **Then** it regains 15 HP (capped at max) and has 1
   hit die left.
3. **Given** a combatant at 0 HP, **When** a long rest is requested, **Then** the engine
   returns refusal `LONG_REST_REQUIRES_HP`.

---

### Edge Cases

- A refused command consumes no dice. The RNG is untouched when the engine refuses (FR-012).
- Damage beyond 0 HP whose remainder is at least the creature's max HP kills outright
  (massive damage), for creatures using death saves.
- Damage taken at 0 HP adds one death-save failure, or two on a critical hit. A stable
  creature that takes damage becomes unconscious again.
- Healing at 0 HP restores consciousness and clears death-save tallies and the Unconscious
  condition that dropping to 0 HP applied.
- A damage or healing roll whose total is below 0 applies 0.
- Temporary hit points never stack. A grant lower than or equal to the current temporary HP
  is refused (`TEMP_HP_NOT_HIGHER`).
- Advantage on an expression without exactly one plain `1d20` term is refused
  (`ADVANTAGE_NOT_APPLICABLE`).
- An expression beyond the dice limits (FR-004) is refused (`DICE_LIMIT_EXCEEDED`), so a
  hostile or confused proposal cannot stall the server.
- A state that fails its schema is refused (`INVALID_STATE`) rather than crashing.
- A combatant in a running encounter cannot be removed (`COMBATANT_IN_ENCOUNTER`).
- Ending an encounter removes conditions that carry a round-based expiry point, because
  round numbers restart in the next encounter.

## Requirements *(mandatory)*

### Functional Requirements

**Entry point and purity**

- **FR-001** (AC #1): The package MUST expose exactly one command entry point,
  `execute(state, command, rng)`, which returns either a non-empty list of events or a
  refusal. It MUST NOT mutate its inputs.
- **FR-002** (AC #1): The package MUST export `evolve(state, event)` and `replay(events)`, so
  that folding the events `execute` returned over the input state yields the next state.
  Read-only selectors (for example `conditionsOf`, `activeCombatant`) MAY be exported; they
  are queries, not commands.
- **FR-003** (AC #1, AC #10): The package MUST perform no I/O. It MUST NOT import a database,
  network, model or clock module, and MUST NOT read the clock or a global random source.

**Dice and RNG**

- **FR-004** (AC #2): The dice parser MUST accept `NdM` (N defaults to 1), integer modifiers,
  keep-highest (`khN`) and keep-lowest (`klN`), and sums of several dice terms (bonus dice,
  for example `1d20+5+1d4` or `1d20+5-1d4`). Limits: at most 100 dice per term, at most 1000
  sides, at most 20 terms, at most 200 characters.
- **FR-005** (AC #2): A roll MUST accept a mode of normal, advantage or disadvantage, applied
  to the expression's single `1d20` term.
- **FR-006** (AC #3): The package MUST provide a seeded RNG that gives the same faces for the
  same seed, and a scripted RNG that returns caller-listed faces in order and fails the test
  loudly when a face is out of range or the script runs out.

**Ledger**

- **FR-007** (AC #4, decision-0021 idea 2): Every roll event MUST carry the reason, the
  expression, every face, the kept faces and the total.
- **FR-008** (AC #4): Every state-change event MUST carry the reason and the before and after
  values of the state it changed.

**Hit points and life**

- **FR-009** (AC #4): The engine MUST apply damage to temporary HP first and then HP, apply
  healing up to max HP, and grant temporary HP without stacking. An amount MAY be a fixed
  number or a dice expression the engine rolls.
- **FR-010** (AC #7): The engine MUST track life state (conscious, unconscious, stable, dead)
  and resolve death saves: 10 or higher succeeds, a natural 1 counts two failures, a natural
  20 restores 1 HP and consciousness, three successes stabilise, three failures kill. A
  combatant whose rule is "dies at 0 HP" MUST die when it reaches 0 HP.

**Conditions**

- **FR-011** (AC #5): Conditions MUST be data records (condition, instance id, source,
  optional exhaustion level, optional expiry point). The engine MUST apply, list and remove
  them, and MUST NOT hard-code their game effects.

**Refusals**

- **FR-012** (AC #9): An illegal command MUST return a refusal with one specific code from a
  closed list, a message and optional details, and MUST produce no events. The engine MUST
  check every precondition before it draws from the RNG.

**Initiative and turns**

- **FR-013** (AC #6): The engine MUST roll initiative (d20 plus bonus, per-participant mode),
  order turns by total, then bonus, then id, track round and active combatant, advance turns,
  skip dead combatants, let a combatant join a running encounter, expire conditions at their
  expiry point, and end the encounter.

**Rests and spell slots**

- **FR-014** (AC #8): A short rest MUST spend named hit dice (each die heals its face plus the
  Con modifier, minimum 0) and restore pact slots. A long rest MUST restore max HP, all hit
  dice and all spell slots, clear temporary HP and death-save tallies, and reduce exhaustion
  by one level. Neither rest MAY run during an encounter.
- **FR-015** (AC #8): The engine MUST expend a spell slot of a named level and pool, and
  restore one outside a rest.

**Boundary and tests**

- **FR-016** (AC #10): `pnpm check:boundaries` MUST fail when the engine package imports a
  database, network or LLM module, or touches the clock, proven by violating fixtures under
  `fixtures/boundary-violations/`.
- **FR-017** (AC #11): Scripted-dice unit tests MUST cover every command type and every
  refusal code, and a meta-test MUST fail when a command type or refusal code has no test.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The gate, the DM runtime and a human DM's own commands MUST
  all drive mechanics through the same `execute` entry point and the same Zod command schema.
  No mechanic has a human-only path.
- **CR-004** (VI. 5e engine boundary): All dice, HP, conditions, initiative, death saves,
  rests and spell slots MUST be computed inside this package. No model rolls or computes a
  number. Session, library and codex code reach these mechanics only through this package.
- **CR-005** (VIII. Operator-owned content): The package MUST NOT ship SRD or other rulebook
  data. Condition names are game terms used as identifiers; SRD records belong to TASK-0043.

(CR-002 and CR-003 do not apply: the feature creates no codex entity and makes no library
claim.)

### Key Entities

- **Engine state**: the combatants and the active encounter, if any. It belongs to the
  session plane: TASK-0044 rebuilds it by folding engine events from the log.
- **Combatant**: an id, a name, hit points (current, max, temporary), a zero-HP rule, a life
  state, death-save tallies, conditions, hit-dice pools, spell-slot pools, an initiative
  bonus and a Con modifier.
- **Condition instance**: one applied condition with its instance id, source, optional
  exhaustion level and optional expiry point.
- **Encounter**: the round, the turn order (combatant, total, bonus) and the active index.
- **Command**: a typed request with a reason. Nineteen kinds (see contracts/commands.md).
- **Event**: a typed, versioned ledger entry with a reason and before/after values.
- **Refusal**: a closed-list code, a message and optional details.
- **RNG**: a die roller the caller supplies, seeded or scripted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the command types and 100% of the refusal codes in the contract have at
  least one scripted-dice test, and the meta-test enforces it.
- **SC-002**: Re-running any command with the same state, command and seed gives deeply equal
  results in 100% of determinism tests.
- **SC-003**: For every command test, folding the returned events over the input state gives
  the expected next state (replay equivalence).
- **SC-004**: Every violating boundary fixture (database, network, LLM, clock) is flagged by
  `pnpm check:boundaries`, and the check fails if any one is not.
- **SC-005**: Every refusal test shows zero events and zero dice drawn.
- **SC-006**: `pnpm ci:check` passes with the new package in the workspace.

## Assumptions

- Rules follow SRD 5.2.1 (decision-0012): exhaustion has six levels and level 6 kills; a
  long rest restores all spent hit dice and needs at least 1 HP; dropping to 0 HP applies the
  Unconscious condition.
- Effects beyond the scoped primitives (resistance, vulnerability, critical-hit dice doubling,
  attack resolution, spell effects, condition effects on rolls) are decided by adjudication
  (TASK-0046) and reach the engine as primitive commands: a final damage amount or
  expression, a roll mode, a condition record.
- Initiative ties break by initiative bonus, then by combatant id. A DM who wants a different
  order uses a later command; no manual reordering command is in scope.
- Round-based expiry points mean something only inside an encounter. Conditions applied with
  an expiry point outside an encounter keep it until removed or until an encounter ends.
- The engine knows no actor, timestamp, sequence number or visibility. The session envelope
  (TASK-0044) and the gate (TASK-0045) add those.
- The seed comes from the caller. The engine generates no ids except condition instance ids,
  which it derives deterministically from the state.
- SRD records (TASK-0043) are not imported by this package.
