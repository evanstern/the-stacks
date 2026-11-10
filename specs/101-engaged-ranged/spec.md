# Feature Specification: Engaged-only ranged penalty

**Feature Branch**: `task-0306-engaged-ranged`

**Created**: 2026-11-10

**Status**: Draft

**Input**: TASK-0306. Operator ruling 2026-11-10: "Engaged-only penalty". The option text: the
penalty applies only when an enemy is actually engaged in melee with the attacker, tracked per
combatant.

## Context

Spec 099 (TASK-0274) gave ranged attack rolls and ranged spell attacks disadvantage whenever a
conscious, able, sighted hostile shares the attacker's zone (`closeCombatFoes` and
`closeCombatSources` in `packages/dnd5e-engine/src/sides.ts`). Spec 100 (TASK-0271) gathers the
party into the encounter zone at encounter start. The reed-camp encounter is one 30-ft zone, so
every ranged attack in that fight rolls at disadvantage. Kestrel, an archer, is penalized on
every shot. SRD 5.2.1 `playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat`
applies the penalty only with an enemy within 5 ft that can see the attacker and is not
Incapacitated.

The operator ruled that the penalty needs a real melee engagement, tracked per combatant. This
spec defines that engagement as engine state. The rule stays in the engine (spec 099 OQ-1
ruling). `speckit-clarify` was skipped: the ruling settles the model, and the remaining judgment
calls are listed under Open questions with recommendations.

### Vocabulary

- **Melee pair**: two hostile combatants recorded as engaged in melee with each other. This is
  the operator's "engaged". The spec says "melee pair" because `engaged` already names a
  zone-mode band in the `space` package (same zone). The two concepts differ, and the band keeps
  its name.
- **Band `engaged`**: unchanged from spec 094. Same zone. It still gates melee reach, the
  melee-or-ranged use split, and opportunity attacks.

### The engagement model

An encounter records melee pairs in `Encounter.melee`, a list of id pairs.

- **A pair forms** when an `attack.roll` with a melee use resolves (hit or miss) in an active
  encounter, the attacker and target are placed in the same zone, and they are hostile
  (`areHostile`). A melee use is a `melee` entry, or a `melee-or-ranged` entry at the `engaged`
  band. A reaction (opportunity) attack counts. A `spell.cast` attack with `range: "melee"`
  counts the same way.
- **A pair ends** when either member's placement changes (`move`, `combatant.place`), or
  either member leaves the order (`initiative.leave`, `combatant.depart`). The encounter's end
  clears every pair.
- **A pair is inert, not removed,** while its foe is not conscious, is unable (`isUnable`), or is
  blinded, or while the attacker is invisible. These are the spec 099 filters, applied at read
  time. A side change (a surrender to `neutral`) makes a pair inert the same way.
- **Turn boundaries do not end a pair.** SRD 5.2.1 asks whether the enemy is within 5 ft now, not
  whether it attacked this round. Two foes stay adjacent until one moves away.
- **Disengage alone does not end a pair** (OQ-2). Disengage stops opportunity attacks. Leaving the
  zone ends the pair.

The close-combat rule then reads: a ranged attack roll (weapon or spell) has disadvantage when
the attacker is in an active melee pair. Sharing a zone alone no longer triggers it.

### Opportunity attacks stay on the zone (divergence)

Spec 094 OQ-1 (same zone means the `engaged` band) and OQ-2 (only the origin zone provokes) are
operator rulings. `provokers` keeps them in this spec. The divergence is deliberate:

- A melee pair answers "is this foe within 5 ft right now". An opportunity attack answers "could
  this foe reach the mover as it leaves". In zone mode, reach is the zone, so every hostile in the
  origin zone may react.
- Narrowing `provokers` to melee pairs changes a ratified spec 094 ruling and the run-1 replay
  test (`apps/server/test/dm/opportunity-attack.integration.test.ts`). That needs its own ruling.
  OQ-1 below asks for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An unengaged archer shoots normally (Priority: P1)

Kestrel shares the reed-camp zone with four goblins. No goblin has made a melee attack against
her, and she has made none. She looses her Shortbow at a goblin with one d20.

**Why this priority**: it is the bug. Every ranged shot in a one-zone fight is wrong today.

**Independent Test**: an engine golden-dice test with a one-zone reed-camp space, and the two DB
tests that gained a second d20 in TASK-0271 (commit `c57d756b`), back to one d20.

**Acceptance Scenarios**:

1. **Given** an active encounter, Kestrel (party) and four goblins (hostile) placed in one zone,
   and no melee pair, **When** Kestrel rolls a Shortbow `attack.roll` with dice `[15]`, **Then**
   the roll's mode is `normal` and it draws one d20.
2. **Given** the same state, **When** Kestrel casts a ranged spell attack, **Then** its mode is
   `normal`.
3. **Given** the reed-camp DB scenario (`derived-numbers`, `revealed-npc` encounter variant),
   **When** Kestrel shoots, **Then** one d20 is drawn.

---

### User Story 2 - An engaged archer still has disadvantage (Priority: P1)

A goblin swings its Scimitar at Kestrel. On her turn she shoots any goblin at disadvantage.

**Why this priority**: it is the SRD rule the penalty exists for (card AC #3).

**Independent Test**: engine golden-dice tests.

**Acceptance Scenarios**:

1. **Given** the US1 state, **When** goblin-1 rolls a Scimitar `attack.roll` against Kestrel (hit
   or miss), **Then** the events include an `encounter.changed` whose `after.melee` holds the
   pair `["goblin-1", "kestrel"]`.
2. **Given** that pair, **When** Kestrel shoots goblin-2 with dice `[15, 4]`, **Then** the mode is
   `disadvantage` and the natural is 4.
3. **Given** Kestrel made a Dagger melee attack against goblin-1, **When** she then shoots,
   **Then** the mode is `disadvantage` (she formed the pair herself).
4. **Given** a pair, **When** Kestrel casts a ranged spell attack, **Then** the mode is
   `disadvantage`.
5. **Given** a goblin's opportunity attack (`reaction: true`) against Kestrel, **When** it
   resolves, **Then** one `encounter.changed` carries both the spent Reaction and the pair.
6. **Given** a pair that already exists, **When** the goblin attacks Kestrel again, **Then** no
   second `encounter.changed` is emitted for the pair.

---

### User Story 3 - Engagement ends (Priority: P2)

**Why this priority**: a pair that never ends is the same bug one swing later.

**Independent Test**: engine golden-dice tests.

**Acceptance Scenarios**:

1. **Given** the pair, **When** Kestrel moves to `camp-post`, **Then** the move's
   `encounter.changed` drops the pair, and her next shot back into reed-camp is `normal`.
2. **Given** the pair, **When** Kestrel takes Disengage and then moves out, **Then** no goblin may
   react (spec 094) and the pair ends.
3. **Given** the pair, **When** Kestrel takes Disengage and stays, **Then** the pair holds and her
   shot is at `disadvantage` (OQ-2).
4. **Given** the pair, **When** goblin-1 drops to 0 HP (or becomes incapacitated, or blinded),
   **Then** Kestrel's next shot is `normal`; the pair stays in state.
5. **Given** the pair, **When** goblin-1 moves away, is re-placed, leaves the order or departs,
   **Then** the pair ends.
6. **Given** the pair, **When** the encounter ends, **Then** no pair survives.
7. **Given** the pair, **When** `turn.advance` runs through a full round, **Then** the pair holds.

---

### Edge Cases

- A melee attack between combatants that are not hostile (party against neutral, sideless) forms
  no pair.
- A melee attack with either combatant unplaced forms no pair.
- An `attack.roll` by `expression` (no entry) forms no pair. The engine cannot tell its range.
- A refused `attack.roll` forms no pair. Refusals emit no events.
- Outside an encounter no pair forms, so a ranged attack has no close-combat disadvantage (OQ-3).
- A state replayed from an older log has no `melee` field. It reads as no pairs.
- Several pairs with one attacker: any active pair gives disadvantage. Modes do not stack
  (`foldMode`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `EncounterSchema` MUST carry an optional `melee` list of id pairs. A missing list
  MUST read as empty. Each pair MUST hold two distinct ids, written in sorted order, and appear
  once.
- **FR-002**: `src/sides.ts` MUST export `meleeFoes(state, id)`: the ids paired with `id` in the
  active encounter. It MUST return `[]` with no encounter.
- **FR-003**: `closeCombatFoes(state, attackerId)` MUST return the members of `meleeFoes` that
  pass the spec 099 filters: hostile, conscious, not unable, not blinded, and the attacker not
  invisible. It MUST NOT read zones. `closeCombatSources` keeps its signature.
- **FR-004**: `attack.roll` MUST add the pair when FR-007's conditions hold. A new pair MUST be
  emitted as `encounter.changed`. With `reaction: true`, the pair and the spent Reaction MUST
  share one `encounter.changed`. A pair already present MUST emit nothing for the pair.
- **FR-005**: `spell.cast` with an attack delivery of `range: "melee"` MUST add the pair under
  the same conditions.
- **FR-006**: `move` and `combatant.place` in an active encounter MUST drop every pair holding the
  combatant. `move` MUST fold the drop into its existing `encounter.changed`. `combatant.place`
  MUST emit `encounter.changed` only when a pair is dropped.
- **FR-007**: A pair forms only when an encounter is active, both combatants are placed in the
  same zone, `areHostile` holds, and the use is melee.
- **FR-008**: `leaveEvents` (`initiative.leave`, `combatant.depart`) MUST drop every pair holding
  the leaving combatant in its `encounter.changed`.
- **FR-009**: `turn.advance`, `movement.action` (Dash, Disengage) and `combatant.side` MUST NOT
  change pairs.
- **FR-010**: `provokers` MUST NOT change (spec 094 OQ-1, OQ-2).
- **FR-011**: The planner's close-combat `rule` fact MUST keep reading `closeCombatSources`. It
  then reports melee pairs, not zones. Planner source does not change.
- **FR-012**: `src/index.ts` MUST export `meleeFoes`.
- **FR-013**: The two DB tests changed by commit `c57d756b` MUST return to one attack d20.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): AI DM, companions and humans form pairs through the same
  `attack` and `cast` Intents and the same gate. No new Intent kind.
- **CR-002** (II. One Intent vocabulary): no new write path. Pairs change only as side effects of
  existing engine commands.
- **CR-003** (III/V. One state): pairs live in engine encounter state and change only through
  versioned `encounter.changed` events. No new event type.
- **CR-004** (VI. Engine owns the numbers): the pair bookkeeping and the disadvantage are engine
  code. The planner reports the engine verdict. Scripted-dice tests cover every changed command.
- **CR-005** (VII. Narration around facts): the roll's mode is already a fact row. No new row.
- **CR-009** (XI. Operator-owned content): cite SRD 5.2.1 rule ids only.

### Key Entities

- **Melee pair**: two hostile combatant ids in `Encounter.melee`. Formed by a melee attack in one
  zone. Ended by a placement change, a leave or the encounter's end.

## Card acceptance criteria

| Card AC | Where |
| --- | --- |
| #1 An operator ruling picks the model, recorded on the card | Done 2026-11-10 ("Engaged-only penalty"); this spec's Context |
| #2 An unengaged archer in the reed-camp fight shoots without disadvantage, golden-dice test | US1; FR-002, FR-003; `packages/dnd5e-engine/test/commands/melee.test.ts`; FR-013 DB tests |
| #3 An archer with a hostile engaged in melee still rolls at disadvantage | US2, US3; FR-004–FR-008; `packages/dnd5e-engine/test/commands/melee.test.ts` |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the reed-camp DB scenarios, Kestrel's first shot draws one d20.
- **SC-002**: Every US1–US3 scenario has a scripted-dice engine test.
- **SC-003**: `pnpm ci:check` is green with no change to `provokers` tests.

## Assumptions

- Zone mode only. Grid mode (R5) measures 5 ft and replaces melee pairs.
- A melee attack is the only signal of adjacency the engine has. A foe that walks up and does not
  swing forms no pair (OQ-4).
- `encounter.changed` stays `v: 1`. The new field is optional and older logs replay unchanged.

## Open questions

- **OQ-1 — Do opportunity attacks narrow to melee pairs too?** Today every hostile in the origin
  zone may react (spec 094 OQ-1). In the reed camp, Kestrel leaving the island draws four
  opportunity attacks from goblins that never closed with her. That is the same over-reach this
  spec fixes for ranged attacks. Narrowing is one condition in `provokers`, but it reverses a
  ratified ruling and rewrites the run-1 replay test. **Recommend:** keep same-zone provokers in
  this PR; card a follow-up for an operator ruling, trigger: a playtest leave that draws an
  attack from a foe that never closed.
- **OQ-2 — Does Disengage alone end a pair?** SRD Disengage only stops opportunity attacks; a foe
  still within 5 ft still imposes the penalty. Zone mode cannot express a 5-ft step back inside a
  zone, so an engaged archer escapes the penalty only by leaving the zone. **Recommend:** no.
  Keep the SRD reading; reed camp has `camp-post` 5 ft away. Revisit with grid mode (R5).
- **OQ-3 — No close-combat penalty outside an encounter.** Free mode had the zone rule before;
  it now has no pairs. Combat runs in turn mode, so the loss is narrow. **Recommend:** accept; no
  card.
- **OQ-4 — Does moving into a foe's zone form a pair?** A foe that moves up and Dodges, or
  Helps, forms none. Forming pairs on arrival would re-create the gather bug for every move into a
  shared zone. **Recommend:** melee attacks only. Card a revisit task, trigger: a playtest where a
  foe stood beside an archer without attacking and the table expected the penalty.
