# Feature Specification: Spells resolve by SRD id through the engine

**Feature Branch**: `task-0105-spells-by-srd-id`

**Created**: 2026-11-03

**Status**: Draft. Spec only (M3 runbook B, lane B3, spine #14, re-split R2). Written against merged
TASK-0104 (spec 082, PR #123). Open questions OQ-1 to OQ-6 below carry defaults; this spec, plan.md and tasks.md
are written against each default.

**Input**: TASK-0105. "When a character casts a spell, interpret or adjudicate emits a spell step
naming the SRD spell record id (and slot level where it applies). The engine looks the record up,
rejects an unknown id, and resolves the spell's attack, save, DC, damage dice, damage type and
conditions from the record plus the caster's stats. The model never writes a spell's numbers."

`speckit-specify` ran as authoring guidance only. The spec dir was already claimed with a stub, so
its branch and directory steps were skipped. `speckit-clarify` was skipped: the card, constitution VI
and spec 082 settle the behaviour. The open questions below are scope edges the card leaves open;
each has a default.

## Decision records and rules this card implements

- **Constitution VI**: the engine owns every number. A model MUST NOT roll or compute them.
- **TASK-0102 operator requirement (2026-10-26)**: "Conditions, spells, and other rules with
  definitions absolutely need to be deterministically defined and resolvable."
- **Spec 082 (TASK-0104)**: combatants carry `stats`; the engine exports `spellSaveDc(stats)` and
  `spellAttackBonus(stats)`; a derived roll the stats cannot support is refused `STAT_UNDEFINED`.
  This card is the first consumer of both spell functions.
- **Decision-0020 (no unplanned "for now")**: every spell this card does not resolve is refused with
  a code, never improvised. Each excluded family is an open question with a follow-up card.

## Order with neighbouring cards (re-split R2)

1. **TASK-0104 (spec 082)** lands first. It adds `stats`, `derive.ts`, the strict check and attack
   steps, `STAT_UNDEFINED`, interpret v11 and adjudicate v8.
2. **TASK-0105 (this card)** adds the spell step, the SRD spell mechanics table, and the engine's
   spell attack and half damage.
3. **TASK-0211** follows (runbook spine #16, after this card merges). Its AC #2 ("a named SRD spell's dice come from its SRD record, Cure Wounds
   2d8 + modifier") **is delivered by this card**: User Story 2 below proves Cure Wounds heals
   `2d8 + Wisdom modifier` from the record. TASK-0211 cites this card for AC #2.
4. **Slot spending (OQ-1, default (a))**: this card also spends the slot through the engine's
   existing `spell-slot.expend` and refuses a cast with no slot left. TASK-0211 keeps its run 1
   replay test (seq 204–210) and AC #3 (narration never states a slot was spent unless the engine
   spent it). If the operator rules OQ-1 (b), the slot branch of `spell.cast` (T006, T011, and
   T029's slot case) moves to TASK-0211 and TASK-0211 keeps all of its AC #1.
5. **TASK-0219** (spell and trait reactions) is out of scope.

## Background: what happens today

1. No node output names a spell. Interpret's intent `spell` plays as model-written check, attack and
   effect steps (`apps/server/src/dm/nodes/schemas.ts`).
2. Runbook A playtest run 1, finding 27 (`docs/playtests/2026-11-02-runbook-a-playtest.md`): Odo
   cast Cure Wounds twice. Both heals rolled the model's `1d8+3`; SRD 5.2.1 Cure Wounds (p. 121) is
   2d8 + spellcasting ability modifier. Neither cast spent a slot.
3. The SRD spell records (`packages/srd`, kind `spell`, 339 records) hold the rules as prose only:
   level, school, range, duration, concentration, `text` and `higherLevels`. No record carries a
   structured attack, save, dice or condition.
4. The engine already has `spell-slot.expend` (refuses `SLOT_LEVEL_UNAVAILABLE` and
   `NO_SLOT_AVAILABLE`), `healing.apply`, `damage.apply` and `condition.apply` with an expiry point.
   The seed carries Odo's spell list and `spellSlots` (`standard: { "1": 2 }`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A spell step names an SRD spell, and the engine resolves it (Priority: P1)

Odo casts Sacred Flame at Snag. Interpret writes one spell step: caster `odo`, spell `sacred-flame`,
target `snag`. The engine rolls Snag's Dexterity save from Snag's stats against Odo's spell save DC
13 (8 + Wis +3 + PB +2). On a failed save, Snag takes 1d8 radiant. The model wrote no number.

**Why this priority**: card AC #1 and #2, the card's outcome.

**Independent Test**: a scripted-dice engine test runs `spell.cast` through `execute`; an interpret
schema test parses the spell step.

**Acceptance Scenarios**:

1. **Given** Odo (Wis +3, PB +2) and a goblin, **When** a `sacred-flame` step resolves, **Then** the
   engine rolls the goblin's Dexterity save against DC 13, and on a failure applies `1d8` radiant.
   On a success no damage applies.
2. **Given** an `inflict-wounds` step by Odo, **When** the target succeeds on its Constitution save,
   **Then** it takes half of the `2d10` necrotic roll, rounded down.
3. **Given** a `fire-bolt` step by a caster with Int +3 and PB +2, **When** it resolves, **Then** the
   engine rolls a ranged spell attack `1d20+5` against the target's AC, and on a hit applies `1d10`
   fire. A critical hit doubles the dice.
4. **Given** a `ray-of-sickness` step that hits during an encounter, **When** it resolves, **Then**
   the target takes `2d8` poison and gains the `poisoned` condition, expiring at the end of the
   caster's next turn.
5. **Given** a spell step with a dice, DC, damage or effect field, **When** the reading is parsed,
   **Then** the strict schema rejects it.

---

### User Story 2 - Healing spells heal by the record (Priority: P1)

Kestrel is down at 0 HP. Odo casts Cure Wounds on her. The engine heals `2d8+3` (2d8 from the record
plus Odo's Wisdom modifier). Kestrel wakes. This is TASK-0211 AC #2.

**Why this priority**: the run 1 bug (finding 27) and the spell the scenario row exercises.

**Independent Test**: a scripted-dice test over `cure-wounds` and `healing-word`; a DB integration
test where Odo heals a downed Kestrel.

**Acceptance Scenarios**:

1. **Given** Odo (Wis +3), **When** a `cure-wounds` step targets Kestrel, **Then** the engine rolls
   `2d8+3` healing. **Given** `slotLevel` 2, **Then** it rolls `4d8+3`.
2. **Given** a `healing-word` step, **Then** the engine rolls `2d4+3`.
3. **Given** Kestrel at 0 HP and unconscious, **When** Cure Wounds heals her, **Then** the engine
   moves her to conscious and removes the `hp-zero` condition (existing `leaveZero`).

---

### User Story 3 - A spell the engine cannot resolve is refused, not improvised (Priority: P1)

Odo casts Bless. Bless needs concentration and a d4 rider on later rolls, which the engine does not
model. The plan gate refuses the action with `SPELL_UNRESOLVED` before any step runs. The narration
reports that the spell did not take hold; no model-written effect lands.

**Why this priority**: card AC #1 and #3.

**Independent Test**: plan-gate unit tests per refusal code; one DB integration test for Bless.

**Acceptance Scenarios**:

1. **Given** a spell step naming `no-such-spell`, **When** the plan gate runs, **Then** it refuses
   the group with `SPELL_UNKNOWN`.
2. **Given** a spell step naming `bless` (an SRD spell with no mechanics entry), **Then** the gate
   refuses with `SPELL_UNRESOLVED`.
3. **Given** a spell step naming `fire-bolt` for Odo, whose seed spell list lacks it, **Then** the
   gate refuses with `SPELL_NOT_PREPARED`.
4. **Given** a reading with intent `spell` and no spell step, **Then** the gate refuses the group
   with `SPELL_UNRESOLVED`.
5. **Given** a `sacred-flame` step with a `slotLevel`, **Then** the gate refuses with
   `SPELL_UNRESOLVED`. **Given** a `cure-wounds` step with `slotLevel` 0, **Then** the schema rejects
   it.
6. **Given** a caster whose stats have no spellcasting ability, **Then** the gate refuses with
   `STAT_UNDEFINED` (spec 082's code).

---

### User Story 4 - A leveled spell spends a slot (Priority: P2, OQ-1 default (a))

Odo has two first-level slots. He casts Cure Wounds twice; each cast spends one slot. His third
cast is refused `NO_SLOT_AVAILABLE` before any healing roll.

**Why this priority**: run 1 finding 27, part 1. Runbook B's "Spell slot" scenario row.

**Independent Test**: a DB integration test casts Cure Wounds three times.

**Acceptance Scenarios**:

1. **Given** Odo with 2 of 2 first-level slots, **When** Cure Wounds resolves, **Then** a
   `spell-slots.changed` row shows expended 0 → 1 before the healing roll.
2. **Given** Odo with 0 slots left, **When** Cure Wounds is planned, **Then** the engine refuses
   `NO_SLOT_AVAILABLE`, the action is refused, and no healing roll lands.
3. **Given** a cantrip (`sacred-flame`), **Then** no slot is spent.

---

### User Story 5 - The prompts render the spell step (Priority: P2)

Interpret and adjudicate show the spell step's shape, the rule that the engine supplies every spell
number, and the caster's spell list in the sheet.

**Why this priority**: card AC #4.

**Independent Test**: prompt tests assert the grammar line, the rule sentence, the version bump and
the rendered spell list.

**Acceptance Scenarios**:

1. **Given** the step grammar, **Then** it shows `{"step":"spell","reason":str,"casterId":id,
   "spellId":SRD spell id,"slotLevel":int|null,"targetId":id}` and states that the engine resolves
   the spell's attack or save, DC, damage, healing and conditions from the SRD record.
2. **Given** Odo's sheet in the actor snapshot, **Then** it lists his spell ids.

### Edge Cases

- **Upcast**: `slotLevel` above the spell's level adds the record's per-level dice. `slotLevel: null`
  casts at the spell's own level. A cantrip takes `slotLevel: null` only.
- **Cantrip scaling**: a cantrip's dice count follows the caster's character level (levels 5, 11 and
  17 add one die each, from the record's `higherLevels`). Shipped PCs are level 1.
- **Free mode**: a turn-bound condition (Ray of Sickness's poisoned) is not applied outside an
  encounter (OQ-4). Its damage still applies.
- **A dead target**: healing and damage are refused `TARGET_DEAD` by the engine, as today.
- **A spell that targets an NPC outside the order**: the plan gate pulls it in, as for an attack
  (specs 068, 075).
- **Monsters and NPCs**: they carry no spell list, so a spell step naming one as caster is refused
  `SPELL_NOT_PREPARED`. Monster spellcasting stays with TASK-0224's follow-up (OQ-6).
- **Free-mode first stage**: a spell step is not a check, so `firstStage` keeps it beside the steps
  before the first check, as today.
- **Human DM seat**: a spell is one `spell.cast` proposal. Its slot, roll and effects land together
  on approval or not at all.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST hold a spell mechanics table: one entry per resolvable SRD spell id,
  giving its delivery (spell attack with range, saving throw with ability and on-save rule, or
  automatic), damage dice and types, healing dice and whether the spellcasting modifier adds, any
  condition and when it ends, and its scaling (cantrip by character level, or per slot level).
- **FR-002**: A test MUST check every mechanics entry against its SRD spell record: the id exists,
  the level matches, and each dice string, attack phrase, save ability, half-damage clause,
  condition name, modifier clause and scaling die appears in the record's `text` or `higherLevels`.
- **FR-003**: The table MUST cover at least `fire-bolt`, `sacred-flame`, `inflict-wounds`,
  `ray-of-sickness`, `cure-wounds` and `healing-word`. It MUST NOT hold an entry for a spell with a
  clause the engine does not model (concentration, an area, more than one target, a repeat save, a
  roll rider).
- **FR-004**: Node output MUST carry a strict `spell` step: `reason`, `casterId`, `spellId`,
  `slotLevel` (1–9 or null) and `targetId`. It MUST carry no dice, DC, damage, healing or effect
  field.
- **FR-005**: The engine MUST accept a `spell.cast` command (`casterId`, `spellId`, `targetId`,
  `slotLevel`, `casterLevel`, optional `houseRules`) and resolve it in one result, before any draw
  refusing `SPELL_UNRESOLVED` (no table entry, a slot level below the spell's level, or a slot level
  on a cantrip), `STAT_UNDEFINED` (no caster spellcasting ability, or a save target with no stats),
  `ACTOR_UNABLE`, `UNKNOWN_COMBATANT` and `TARGET_DEAD` as the attack and heal paths do today.
- **FR-006**: A leveled `spell.cast` MUST spend one slot of its cast level as its first event, with
  the same rules and refusals as `spell-slot.expend` (`SLOT_LEVEL_UNAVAILABLE`,
  `NO_SLOT_AVAILABLE`). A cantrip spends none (OQ-1 (a)).
- **FR-007**: An attack spell MUST roll `1d20±(spell attack bonus − 2 × exhaustion)` against the
  target's AC, folding condition modes as a named attack does (spec 082), and on a hit apply the
  entry's damage (doubled dice on a critical hit).
- **FR-008**: A save spell MUST roll the target's derived saving throw against the caster's spell
  save DC, then apply full damage on a failure and half (rounded down, before defenses) or none on a
  success, per the entry. `hp.changed` MUST record `half: true` when halved.
- **FR-009**: A heal spell MUST roll the entry's dice plus the caster's spellcasting modifier as
  healing, through the existing healing rules (a downed target wakes).
- **FR-010**: A condition entry MUST apply its condition on a hit or a failed save, expiring at the
  end of the caster's next turn when the entry says so. Outside an encounter a turn-bound condition
  is not applied (OQ-4).
- **FR-011**: The plan gate MUST refuse a group before any step runs with `SPELL_UNKNOWN` when a
  spell id is not an SRD spell record, `SPELL_NOT_PREPARED` when it is not on the caster's seed
  spell list, `SPELL_UNRESOLVED` when the engine table has no entry or the slot level is invalid, and
  `STAT_UNDEFINED` per FR-005. It MUST refuse `SPELL_UNRESOLVED` when a reading with intent `spell`
  plans no spell step.
- **FR-012**: The plan gate MUST check a spell step's `casterId` as the action's actor (spec 079),
  walk `casterId` and `targetId` as named ids (pull-in included), and claim-check its `reason`.
- **FR-013**: Resolve MUST submit one `spell.cast` per spell step, with `casterLevel` from the seed
  character (1 for a non-PC) and the seed's house rules. It MUST write no number of its own.
- **FR-014**: The step grammar and the interpret and adjudicate prompts MUST render the spell step
  shape and state that spell numbers come from the engine. Both prompt versions MUST bump one past
  `main`. The actor snapshot's sheet MUST list the caster's spell ids.
- **FR-015**: The shipped seeds MUST add `cure-wounds` to Odo's spell list (a level 1 cleric prepares
  four spells; he lists two leveled spells).

### Acceptance criteria mapping (card TASK-0105)

| Card AC | Requirements | Proving test |
|---|---|---|
| #1 a spell step names an SRD spell id; an unknown id is rejected by the gate | FR-004, FR-011, FR-012 | `interpret.test.ts`, `plan-gate.test.ts` |
| #2 the engine resolves attack or save, DC, damage and conditions from the SRD record and the caster's stats; no model-written spell number | FR-001, FR-002, FR-005, FR-007–FR-010, FR-013 | engine `spells.test.ts`; server `spell-mechanics.test.ts`; `spells.integration.test.ts` |
| #3 a spell the engine cannot resolve is refused with a code, not improvised | FR-003, FR-005, FR-011 | engine `spells.test.ts`; `plan-gate.test.ts`; `spells.integration.test.ts` (Bless) |
| #4 the prompts render the spell step and say spell numbers come from the engine | FR-014 | `interpret-prompt.test.ts`, `snapshot-render.test.ts` |
| #5 scripted-dice engine tests for one attack, one save and one condition spell; dm tests and the scripted CI playtest green | FR-006–FR-010 | engine `spells.test.ts` (fire-bolt, sacred-flame, inflict-wounds, ray-of-sickness, cure-wounds, healing-word); `pnpm ci:check` incl. `harness.integration.test.ts` |

TASK-0211 AC #2 maps to User Story 2, FR-009 and the engine `spells.test.ts` Cure Wounds cases.

### Key Entities

- **Spell mechanics entry**: the structured rules of one SRD spell, held in the engine and keyed by
  the SRD spell id, checked against the record's text by a test. Code reads it; a model never
  writes it.
- **Spell step**: the model's choice of caster, spell, slot level and target. It carries no number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero spell numbers (dice, DC, to-hit, healing) in any plan step that reaches resolve.
- **SC-002**: Every resolvable spell's dice line in the scripted runs equals its SRD record's dice
  plus the caster's derived modifier, where the record adds one.
- **SC-003**: 100% of spell steps naming an unknown, unprepared or unresolvable spell are refused
  with a code before any dice row.
- **SC-004**: Every leveled cast lands exactly one `spell-slots.changed` row; a cast with no slot
  lands none and no roll.

## Open questions (operator)

Each question names its default. The spec, plan and tasks are written against the default.

- **OQ-1 — Slot spending here or in TASK-0211.** (a) `spell.cast` spends the slot (FR-006): the
  spell step already carries `slotLevel`, the engine already has the slot rules, and a cast that
  names a slot level but spends nothing would reproduce finding 27 in a new form. TASK-0211 keeps
  the seq 204–210 replay test (AC #1's test) and AC #3 (narration never claims an unspent slot).
  (b) This card validates `slotLevel` only; TASK-0211 adds the expend to `spell.cast`. **Default
  (a).**
- **OQ-2 — Spells the engine does not model.** Concentration (Bless, Guidance), area and
  multi-target spells (Burning Hands, Color Spray, Magic Missile), repeat saves (Hold Person), and
  roll riders (Guiding Bolt's advantage, Shocking Grasp's no-reactions, Ray of Frost's speed) are
  refused `SPELL_UNRESOLVED`. (a) Card one follow-up per family. (b) Widen this card. **Default
  (a)**; the orchestrator cards: concentration and roll buffs, area and multi-target, repeat saves.
- **OQ-3 — Mechanics source.** (a) A hand-authored table in the engine, keyed by SRD spell id and
  checked clause by clause against the record text by a server test. (b) Parse the record prose at
  runtime. (c) Add structured fields to the SRD spell records. **Default (a)**: prose parsing is
  brittle; (c) would put rules data the engine needs in a package the engine may not import (its
  purity test allows `zod` only).
- **OQ-4 — Turn-bound conditions outside an encounter.** (a) Not applied. (b) Applied with no
  expiry. **Default (a)**: a condition that ends
  within one round cannot outlast a free-mode beat, and (b) leaves it on forever.
- **OQ-5 — Spell list as a gate.** (a) The caster's seed `spells` list gates the step
  (`SPELL_NOT_PREPARED`); the shipped seeds give Odo `cure-wounds`. (b) Any SRD spell of the
  caster's class. **Default (a)**; TASK-0058 (m-4) later replaces the seed list with the sheet.
- **OQ-6 — Monster spellcasting.** (a) Out of scope: a monster has no spell list, so its spell step
  is refused. Card it beside TASK-0224 (feature DCs). (b) Include. **Default (a).**

## Assumptions

- TASK-0104 (spec 082) has merged (PR #123). Its exports keep the names plan.md R1 lists; Phase 0 of
  tasks.md re-checks them and records any rename in `deviations.md`.
- Main is at interpret-v11 and adjudicate-v8 after TASK-0104. This card bumps each one past `main`.
  Narrate and audit are not touched.
- Shipped PCs are level 1. Cantrip scaling is implemented and tested, but no shipped run exercises it.
- No migration and no new runtime dependency.
